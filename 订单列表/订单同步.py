# 使用提醒:
# 1. xbot包提供软件自动化、数据表格、Excel、日志、AI等功能
# 2. package包提供访问当前应用数据的功能，如获取元素、访问全局变量、获取资源文件等功能
# 3. 当此模块作为流程独立运行时执行main函数
# 4. 可视化流程中可以通过"调用模块"的指令使用此模块

import xbot
from xbot import print, sleep
from .import package
from .package import variables as glv

import asyncio
import json
import mysql.connector
from contextlib import contextmanager
from collections import OrderedDict
from itertools import islice
from collections import defaultdict
from .openapi import BaseApi
from .resp_schema import ResponseResult
from .config import Config
import time


DB_CONF = {
    "host": glv.get("A_host"),
    "user": glv.get("A_user"),
    "password": glv.get("A_password"),
    "database": glv.get("A_nocobase"),
    "port": 3306
}

ORDER_LIST_FIELDS = [
    "shop",
    "country",
    "order_currency",
    "order_number",
    "status",
    "buyer_name",
    "order_date",
    "asin",
    "msku",
    "sku",
    "product_name",
    "exchange_order",
    "is_exchanged",
    "is_returned",
    "is_refunded",
    "order_total_amount",
    "country_code",
    "model",
    "maintenance_level",
    "unit_price",
    "is_large_discount",
    "asin_country_code",
    "sid",
    "store_en",
    "refund_total_amount",
]

@contextmanager
def get_db_conn(dict_cursor=False):
    """数据库连接上下文"""
    conn = mysql.connector.connect(**DB_CONF)
    cursor = conn.cursor(dictionary=dict_cursor)
    try:
        yield conn, cursor
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


class Api(BaseApi):
    CHANNEL_COUNTRY_MAP = {
        "Amazon.co.uk": "英国",
        "Amazon.de": "德国",
        "Amazon.com": "美国",
        "Amazon.fr": "法国",
        "Amazon.es": "西班牙",
        "Amazon.it": "意大利",
        "Amazon.nl": "荷兰",
        "Amazon.co.jp": "日本",
        "Amazon.se": "瑞典",
        "Amazon.ca": "加拿大",
        "Amazon.com.mx": "墨西哥",
    }

    """查询亚马逊订单列表"""
    async def query_orders(self, start_date, end_date) -> ResponseResult:
        path = '/erp/sc/data/mws/orders'
        all_data = []
        offset = 0
        length = 5000  # 最大允许长度
        while True:
            body = {
                "start_date": start_date,
                "end_date": end_date,
                "sort_desc_by_date_type": 1,
                "date_type": 2, # 订单修改时间【北京时间】
                "offset": offset,
                "length": length,
            }
            result = await self.request(path, "POST", req_body=body)
            if result.code != 0:
                return result
            if not result.data:
                break
            all_data.extend(result.data)
            if len(result.data) < length:
                break
            offset += length
        print(f"查询总数据：{len(all_data)}")
        start = time.perf_counter()   # 开始计时
        filtter_data = await self.handle_orders_data(all_data)
        end = time.perf_counter()     # 结束计时
        print(f"处理后总数据：{len(filtter_data)}")
        print(f"处理耗时：{end - start:.4f} 秒")
        self.upsert_order_list(filtter_data)
        return ResponseResult(code=result.code, message=result.message, data=filtter_data,error_details=result.error_details, request_id=result.request_id, response_time=result.response_time, total=result.total)
 
    """查询亚马逊订单详情"""
    async def query_order_detail(self, order_id) -> ResponseResult:
        
        path = '/erp/sc/data/mws/orderDetail'
        body = {
            "order_id": order_id,
        }
        return await self.request(path, "POST", req_body=body)


    """处理数据（优化版：先查完再处理）"""
    async def handle_orders_data(self, data):
        orders = []
        
        # ========== 阶段1: 批量查询所有订单详情 ==========
        print(f"[阶段1] 开始批量查询订单详情...")
        stage1_start = time.perf_counter()
        
        all_details = []  # 存储所有详情
        detail_map = {}   # 订单ID → 详情映射
        
        for batch_data in self.chunked_iterable(data, 200):
            # API 查询
            batch_ids = [order["amazon_order_id"] for order in batch_data if order.get("amazon_order_id")]
            if not batch_ids:
                continue
                
            unique_batch_ids = list(set(batch_ids))
            batch_id_str = ",".join(unique_batch_ids)
            
            api_start = time.perf_counter()
            res = await self.query_order_detail(batch_id_str)
            api_duration = time.perf_counter() - api_start
            if res.code != 0:
                return []
            print(f"  [API] 耗时: {api_duration:.4f}秒 | 查询 {len(unique_batch_ids)} 个订单 | 返回 {len(res.data)} 条")
            
            
            # 构建索引
            for detail in res.data:
                if detail:
                    order_id = detail.get("amazon_order_id")
                    if order_id:
                        detail_map.setdefault(order_id, []).append(detail)
                        all_details.append(detail)
        
        stage1_duration = time.perf_counter() - stage1_start
        print(f"[阶段1] 完成！耗时: {stage1_duration:.4f}秒 | 共获取 {len(all_details)} 条详情\n")
        
        # ========== 阶段2: 收集所有需要查询的 SKU/ASIN ==========
        print(f"[阶段2] 开始收集数据...")
        stage2_start = time.perf_counter()
        
        country_map = self.fetch_country_codes()
        channel_map = self.CHANNEL_COUNTRY_MAP  # 缓存类属性

        shop_shortName_map = self.read_shop_data()
        shortName_frontSeller_map = self.read_seller_data()
        
        temp_rows = []
        all_needed_skus = set()
        all_needed_maintenance_keys = set()
        
        for order_item in data:
            order_get = order_item.get
            order_id = order_get("amazon_order_id")
            refund_total_amount = order_get("refund_amount") or 0

            if not order_id:
                continue
            
            detail_list = detail_map.get(order_id)
            if not detail_list:
                continue
            
            detail = detail_list[0]
            detail_get = detail.get
            
            item_list = detail_get("item_list")
            if not item_list:
                continue
            
            item = item_list[0]
            item_get = item.get
            
            # 获取国家信息
            sales_channel = detail_get("sales_channel")
            country = channel_map.get(sales_channel, "未知渠道")
            country_code = country_map.get(country, "")
            
            sku = item_get("sku")
            asin = item_get("asin")
            sid = item_get("sid")
            
            # 收集需要查询的数据
            if sku:
                all_needed_skus.add(sku)
            
            if asin and country_code:
                all_needed_maintenance_keys.add((asin, country_code))
            
            # 暂存数据（提前提取所有需要的值）
            seller_name = order_get("seller_name")
            if 'G-淮优' in seller_name:
                continue
            short_name = shop_shortName_map.get(seller_name)

            # 处理带有 '/' 的多简称情况匹配 store_en
            store_en = ''
            if short_name:
                # 1. 先尝试直接精确匹配（最快）
                store_en = shortName_frontSeller_map.get(short_name, '')
                
                # 2. 如果没匹配到，说明可能存在 '/'，进行拆分交叉匹配
                if not store_en:
                    short_name_set = set(short_name.split('/'))
                    for key, val in shortName_frontSeller_map.items():
                        if key and (short_name_set & set(key.split('/'))):
                            store_en = val
                            break

            temp_rows.append({
                "seller_name": seller_name,
                "order_id": order_id,
                "currency": detail_get("currency"),
                "order_status": detail_get("order_status"),
                "purchase_date": detail_get("purchase_date_local"),
                "is_replaced_order": detail_get("is_replaced_order"),
                "is_replacement_order": detail_get("is_replacement_order"),
                "is_return_order": detail_get("is_return_order"),
                "is_return": detail_get("is_return"),
                "order_total_amount": detail_get("order_total_amount"),
                "seller_sku": item_get("seller_sku"),
                "product_name": item_get("product_name"),
                "unit_price": item_get("unit_price_amount") or 0,
                "item_discount": item_get("item_discount") or 0,
                "country": country,
                "country_code": country_code,
                "sku": sku,
                "asin": asin,
                "sid": sid,
                "store_en": store_en,
                "refund_total_amount": refund_total_amount,
            })
        
        stage2_duration = time.perf_counter() - stage2_start
        print(f"[阶段2] 完成！耗时: {stage2_duration:.4f}秒")
        print(f"  - 收集订单: {len(temp_rows)} 条")
        print(f"  - 需查询SKU: {len(all_needed_skus)} 个")
        print(f"  - 需查询维护等级: {len(all_needed_maintenance_keys)} 个\n")
        
        # ========== 阶段3: 一次性查询所有数据库数据 ==========
        print(f"[阶段3] 开始查询数据库...")
        stage3_start = time.perf_counter()
        
        # 一次性查询所有 SKU
        sku_map = {}
        if all_needed_skus:
            db_start = time.perf_counter()
            sku_map = self.fetch_sku_models(list(all_needed_skus))
            db_duration = time.perf_counter() - db_start
            print(f"  [DB-SKU] 耗时: {db_duration:.4f}秒 | 查询 {len(all_needed_skus)} 个SKU | 返回 {len(sku_map)} 条")
        
        # 一次性查询所有维护等级
        maintenance_map = {}
        if all_needed_maintenance_keys:
            db_start = time.perf_counter()
            maintenance_map = self.fetch_maintenance_levels(list(all_needed_maintenance_keys))
            db_duration = time.perf_counter() - db_start
            print(f"  [DB-维护] 耗时: {db_duration:.4f}秒 | 查询 {len(all_needed_maintenance_keys)} 个 | 返回 {len(maintenance_map)} 条")
        
        stage3_duration = time.perf_counter() - stage3_start
        print(f"[阶段3] 完成！耗时: {stage3_duration:.4f}秒\n")
        
        # ========== 阶段4: 组装最终结果 ==========
        print(f"[阶段4] 开始组装结果...")
        stage4_start = time.perf_counter()
        
        for row in temp_rows:
            asin = row["asin"]
            country_code = row["country_code"]
            
            # 从缓存获取数据
            model = sku_map.get(row["sku"], "")
            
            if asin and country_code:
                maintenance_level = maintenance_map.get((asin, country_code), "")
                asin_country_code = f"{asin}_{country_code}"
            else:
                maintenance_level = ""
                asin_country_code = ""
            
            big_discount = self.check_discount(row["unit_price"], row["item_discount"])
            
            orders.append({
                "shop": row["seller_name"],
                "country": row["country"],
                "order_currency": row["currency"],
                "order_number": row["order_id"],
                "status": row["order_status"],
                "buyer_name": "",
                "order_date": row["purchase_date"],
                "asin": asin,
                "msku": row["seller_sku"],
                "sku": row["sku"],
                "product_name": row["product_name"],
                "exchange_order": "是" if row["is_replaced_order"] else "否",
                "is_exchanged": "是" if row["is_replacement_order"] else "否",
                "is_returned": "是" if row["is_return_order"] else "否",
                "is_refunded": "是" if row["is_return"] == 2 else "否",
                "order_total_amount": row["order_total_amount"],
                "country_code": country_code,
                "model": model,
                "maintenance_level": maintenance_level,
                "unit_price": row["unit_price"],
                "is_large_discount": big_discount,
                "asin_country_code": asin_country_code,
                "sid": row["sid"],
                "store_en": row["store_en"],
                "refund_total_amount": row["refund_total_amount"],
            })
        
        stage4_duration = time.perf_counter() - stage4_start
        print(f"[阶段4] 完成！耗时: {stage4_duration:.4f}秒 | 组装 {len(orders)} 条订单\n")
        
        # ========== 总结 ==========
        total_duration = stage1_duration + stage2_duration + stage3_duration + stage4_duration
        print("=" * 60)
        print(f"【总耗时】: {total_duration:.4f}秒")
        print(f"  - 阶段1 (API查询):    {stage1_duration:.4f}秒 ({stage1_duration/total_duration*100:.1f}%)")
        print(f"  - 阶段2 (数据收集):   {stage2_duration:.4f}秒 ({stage2_duration/total_duration*100:.1f}%)")
        print(f"  - 阶段3 (数据库查询): {stage3_duration:.4f}秒 ({stage3_duration/total_duration*100:.1f}%)")
        print(f"  - 阶段4 (结果组装):   {stage4_duration:.4f}秒 ({stage4_duration/total_duration*100:.1f}%)")
        print("=" * 60)
        
        return orders



    """将可迭代对象按 size 分块"""
    def chunked_iterable(self,iterable, size):
        it = iter(iterable)
        while True:
            chunk = list(islice(it, size))
            if not chunk:
                break
            yield chunk

    def upsert_order_list(self, rows, batch_size=1000, max_retries=3, retry_interval=2):
        """批量插入/更新 order_list，按批次失败重试。"""
        if not rows:
            print("order_list 无需写入：本次没有订单数据")
            return 0

        fields_sql = ", ".join([f"`{field}`" for field in ORDER_LIST_FIELDS])
        placeholders = ", ".join(["%s"] * len(ORDER_LIST_FIELDS))
        update_fields = [field for field in ORDER_LIST_FIELDS if field != "order_number"]
        update_sql = ",\n            ".join([
            f"`{field}`=VALUES(`{field}`)" for field in update_fields
        ])
        insert_sql = f"""
        INSERT INTO `order_list`
            ({fields_sql})
        VALUES ({placeholders})
        ON DUPLICATE KEY UPDATE
            {update_sql}
        """

        total_rows = len(rows)
        total_batches = (total_rows + batch_size - 1) // batch_size
        written_rows = 0
        print(f"开始写入 order_list：{total_rows} 条，批次大小 {batch_size}，共 {total_batches} 批")

        for batch_num, batch_rows in enumerate(self.chunked_iterable(rows, batch_size), start=1):
            params = [
                tuple(row.get(field) for field in ORDER_LIST_FIELDS)
                for row in batch_rows
            ]

            for attempt in range(1, max_retries + 1):
                try:
                    with get_db_conn() as (conn, cursor):
                        cursor.executemany(insert_sql, params)
                    written_rows += len(batch_rows)
                    if batch_num % 10 == 0 or batch_num == total_batches:
                        print(f"order_list 写入进度：{batch_num}/{total_batches} 批，{written_rows}/{total_rows} 条")
                    break
                except mysql.connector.Error as e:
                    if attempt >= max_retries:
                        print(f"order_list 第 {batch_num} 批写入失败，已重试 {attempt} 次")
                        raise
                    wait_seconds = retry_interval * attempt
                    print(f"order_list 第 {batch_num} 批写入失败，{wait_seconds} 秒后第 {attempt + 1} 次重试：{e}")
                    time.sleep(wait_seconds)

        print(f"order_list 写入完成：{written_rows}/{total_rows} 条")
        return written_rows


    



    # =============================
    # 数据库工具函数
    # =============================
    def fetch_country_codes(self):
        sql = """
        SELECT country_chinese, country_code from country
        """

        with get_db_conn() as (conn, cursor):
            cursor.execute(sql)
            rows = cursor.fetchall()

        country_map = {country_chinese: country_code for country_chinese, country_code in rows}
        return country_map

    def fetch_sku_models(self, skus) -> dict:
        if not skus:
            return {}
        
        sql = f"SELECT sku, model FROM sku WHERE sku IN ({','.join(['%s']*len(skus))})"
        
        with get_db_conn() as (conn, cursor):
            cursor.execute(sql, tuple(skus))
            rows = cursor.fetchall()
        
        return {row[0]: row[1] for row in rows}

    def fetch_maintenance_levels(self, asin_country_list) -> dict:
        if not asin_country_list:
            return {}

        # 拆分为 asin 和 country_code 两个列表（保持不变）
        asin_list = [ac[0] for ac in asin_country_list]
        country_list = [ac[1] for ac in asin_country_list]

        sql = f"""
            SELECT asin, country, maintenance_level
            FROM asin
            WHERE asin IN ({','.join(['%s']*len(set(asin_list)))})
            AND country IN ({','.join(['%s']*len(set(country_list)))})
        """

        with get_db_conn() as (conn, _cursor):
            # 为了完全保持你原来的 dictionary=True 行为，这里从 conn 新建字典游标
            cursor = conn.cursor(dictionary=True)
            cursor.execute(sql, tuple(set(asin_list)) + tuple(set(country_list)))
            rows = cursor.fetchall()
            cursor.close()

        return {(row["asin"], row["country"]): row["maintenance_level"] for row in rows}

    def read_seller_data(self):
        sql = """
        SELECT front_seller_name, store_short_name 
        FROM seller_account
        """

        with get_db_conn() as (conn, cursor):
            cursor.execute(sql)
            rows = cursor.fetchall()

        seller_map = {store_short_name: front_seller_name for front_seller_name, store_short_name in rows}
        
        return seller_map

    def read_shop_data(self):
        sql = """
        SELECT name, short_name 
        FROM shop
        """

        with get_db_conn() as (conn, cursor):
            cursor.execute(sql)
            rows = cursor.fetchall()

        shop_shortName_map = {name: short_name for name, short_name in rows}
        
        return shop_shortName_map


    def check_discount(self, price, discount):
        if not price or float(price) == 0:
            return "否"
        elif discount and float(discount) / float(price) > 0.3:
            return "是"
        else:
            return "否"


async def asynchronous_service(start_date, end_date):
    order_api = Api(Config.HOST, Config.APP_ID, Config.APP_SECRET)
    

    task1 = asyncio.create_task(order_api.query_orders(start_date, end_date))
    result = await task1
    if result.code != 0:
        raise Exception(f"{result.message}：{result.error_details}")
    return json.loads(result.model_dump_json())

def main(start_date, end_date):
    return asyncio.run(asynchronous_service(start_date, end_date))

