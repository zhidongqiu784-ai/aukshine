# 使用提醒:
# 1. xbot包提供软件自动化、数据表格、Excel、日志、AI等功能
# 2. package包提供访问当前应用数据的功能，如获取元素、访问全局变量、获取资源文件等功能
# 3. 当此模块作为流程独立运行时执行main函数
# 4. 可视化流程中可以通过"调用模块"的指令使用此模块

import xbot
from xbot import print, sleep
from . import package
from .package import variables as glv
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from contextlib import contextmanager
import mysql.connector
import time

_xbot_print = print


def print(message="", *args, **kwargs):
    """让影刀日志每条都是单行，避免前导换行导致列表里显示 ... 需要双击展开。"""
    if args:
        message = " ".join([str(message)] + [str(arg) for arg in args])
    lines = str(message).splitlines()
    while lines and lines[0].strip() == "":
        lines.pop(0)
    for line in lines:
        if line.strip():
            _xbot_print(line, **kwargs)

# ================= 配置 =================
DB_CONF = {
    "host": glv.get("A_host"),
    "user": glv.get("A_user"),
    "password": glv.get("A_password"),
    "database": glv.get("A_nocobase"),
    "port": 3306,
    "connection_timeout": 15
}

DEBUG = True
FUTURE_DAYS = 180
ORDER_START_DATE = '2025-01-01'
QUERY_TIMEOUT_SECONDS = 600
LOCK_WAIT_TIMEOUT_SECONDS = 60


# ================= 打印工具 =================
def print_title(title, width=80):
    print("\n" + "=" * width)
    print(title)
    print("=" * width)


def print_subtitle(title, width=60):
    print("\n" + "-" * width)
    print(title)
    print("-" * width)


def print_df_preview(df, name, rows=10):
    if not DEBUG:
        return
    print_subtitle(f"{name} 预览（前 {rows} 条）")
    if df is None or len(df) == 0:
        print(f"{name}: 空数据")
        return
    print(df.head(rows).to_string(index=False))
    print(f"\n{name} 总行数: {len(df):,}")


def print_group_summary(df, group_cols, name, top_n=20):
    if not DEBUG:
        return
    print_subtitle(f"{name} 分组统计（Top {top_n}）")
    if df is None or len(df) == 0:
        print(f"{name}: 空数据")
        return
    summary = df.groupby(group_cols).size().reset_index(name='count')
    summary = summary.sort_values('count', ascending=False).head(top_n)
    print(summary.to_string(index=False))


# ================= 数据库连接 =================
def configure_db_session(cursor):
    session_settings = [
        f"SET SESSION innodb_lock_wait_timeout = {LOCK_WAIT_TIMEOUT_SECONDS}",
        f"SET SESSION lock_wait_timeout = {LOCK_WAIT_TIMEOUT_SECONDS}",
        f"SET SESSION max_execution_time = {QUERY_TIMEOUT_SECONDS * 1000}",
        f"SET SESSION max_statement_time = {QUERY_TIMEOUT_SECONDS}",
    ]
    for stmt in session_settings:
        try:
            cursor.execute(stmt)
        except Exception:
            # 不同 MySQL/MariaDB 版本支持的超时变量不同，能设置哪个就用哪个。
            pass


@contextmanager
def get_db_conn(dict_cursor=False):
    conn = mysql.connector.connect(**DB_CONF)
    cursor = conn.cursor(dictionary=dict_cursor)
    configure_db_session(cursor)
    try:
        yield conn, cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def read_sql_logged(query, conn, name):
    started_at = time.time()
    print(f"{name} 查询开始...")
    try:
        df = pd.read_sql(query, conn)
    except Exception:
        elapsed = time.time() - started_at
        print(f"{name} 查询失败，已耗时 {elapsed:.2f} 秒")
        raise
    elapsed = time.time() - started_at
    print(f"{name} 查询完成，耗时 {elapsed:.2f} 秒，记录数 {len(df):,}")
    return df


# ================= 创建临时中间表 =================
def create_work_valid_combinations(conn, cursor, table_name):
    print(f"\n[2/9] 创建临时中间表 {table_name} ...")

    create_sql = f"""
        CREATE TEMPORARY TABLE {table_name} AS
        SELECT DISTINCT
            cs.shop,
            cs.country,
            cs.asin,
            NULLIF(a.model, '') AS asin_model
        FROM current_stock cs
        INNER JOIN asin a
            ON cs.country = a.country
           AND cs.asin = a.asin
        WHERE a.status IN ('新品', '重点', '普通')
          AND COALESCE(a.maintenance_level, '') != '变体'
          AND cs.shop IS NOT NULL
          AND cs.shop != ''
          AND cs.shop != '合计'
          AND cs.shop_country_asin IS NOT NULL
          AND cs.shop_country_asin != ''
    """
    cursor.execute(create_sql)

    cursor.execute(f"""
        CREATE INDEX idx_{table_name[-8:]}_sca
        ON {table_name} (shop, country, asin)
    """)

    cursor.execute(f"""
        CREATE INDEX idx_{table_name[-8:]}_cas
        ON {table_name} (country, asin, shop)
    """)

    valid_combinations = read_sql_logged(f"SELECT * FROM {table_name}", conn, table_name)

    print(f"有效组合数: {len(valid_combinations):,}")
    print_df_preview(valid_combinations, table_name, 20)
    print_group_summary(valid_combinations, ['shop'], f"{table_name} 按 shop")
    print_group_summary(valid_combinations, ['country'], f"{table_name} 按 country")

    return valid_combinations


# ================= 展开未来数据 =================
def expand_future_data(base_df, future_dates_df):
    if len(base_df) == 0:
        return pd.DataFrame(columns=[
            'shop_country_asin_date', 'asin', 'model', 'country', 'shop', 'date', 'week', 'sales'
        ])

    n_base = len(base_df)
    n_dates = len(future_dates_df)

    expanded = pd.DataFrame({
        'shop': np.repeat(base_df['shop'].values, n_dates),
        'country': np.repeat(base_df['country'].values, n_dates),
        'asin': np.repeat(base_df['asin'].values, n_dates),
        'model': np.repeat(base_df['model'].values, n_dates),
        'date': np.tile(future_dates_df['date'].values, n_base)
    })

    expanded['week'] = expanded['date']
    expanded['sales'] = None
    expanded['shop_country_asin_date'] = (
        expanded['shop'].astype(str) + '_' +
        expanded['country'].astype(str) + '_' +
        expanded['asin'].astype(str) + '_' +
        pd.to_datetime(expanded['date']).dt.strftime('%Y%m%d')
    )

    return expanded[[
        'shop_country_asin_date', 'asin', 'model', 'country', 'shop', 'date', 'week', 'sales'
    ]]


# ================= 主逻辑 =================
def generate_sales_forecast():
    current_date = datetime.now().date()
    work_suffix = int(time.time())
    work_table = f"tmp_valid_combinations_{work_suffix}"
    woot_asin_table = f"tmp_woot_asins_{work_suffix}"
    woot_asin_lookup_table = f"tmp_woot_asins_lookup_{work_suffix}"

    print_title(f"开始生成数据: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"本次中间表名: {work_table}")

    # 1. 未来日期
    print("\n[1/9] 生成未来日期...")
    future_dates_df = pd.DataFrame({
        'date': [current_date + timedelta(days=i) for i in range(FUTURE_DAYS)]
    })
    print(f"生成未来日期数: {len(future_dates_df):,}")
    print_df_preview(future_dates_df, "future_dates_df", 10)

    try:
        with get_db_conn() as (conn, cursor):
            # 2. 创建中间表
            valid_combinations = create_work_valid_combinations(conn, cursor, work_table)

            # 3. base_data
            print("\n[3/9] 获取基础数据 (base_data)...")
            latest_model_query = f"""
                SELECT
                    tvc.shop,
                    tvc.country,
                    tvc.asin,
                    (
                        SELECT sk.model
                        FROM shop s
                        STRAIGHT_JOIN order_list ol
                          ON ol.shop = s.name
                         AND ol.country_code = tvc.country
                         AND ol.asin = tvc.asin
                        STRAIGHT_JOIN sku sk
                          ON sk.sku = ol.sku
                        WHERE s.short_name = tvc.shop
                          AND ol.order_date >= '{ORDER_START_DATE}'
                          AND ol.order_date <= CURDATE()
                          AND ol.status != 'Canceled'
                          AND ol.country_code IS NOT NULL AND ol.country_code != ''
                          AND ol.asin IS NOT NULL AND ol.asin != ''
                          AND ol.sku IS NOT NULL AND ol.sku != ''
                          AND sk.model IS NOT NULL AND sk.model != ''
                        ORDER BY ol.order_date DESC
                        LIMIT 1
                    ) AS model
                FROM {work_table} tvc
                WHERE tvc.asin_model IS NULL
            """
            latest_models = read_sql_logged(latest_model_query, conn, "latest_models_missing_asin_model")
            latest_models = latest_models[latest_models['model'].notna()].copy()
            base_data = valid_combinations.merge(
                latest_models,
                on=['shop', 'country', 'asin'],
                how='left'
            )
            base_data['model'] = base_data['asin_model'].combine_first(base_data['model'])
            base_data = base_data.drop(columns=['asin_model'])

            print(f"base_data 记录数: {len(base_data):,}")
            print_df_preview(base_data, "base_data", 20)

            base_data['has_order'] = base_data['model'].notna()
            has_order_count = int(base_data['has_order'].sum())
            no_order_count = int((~base_data['has_order']).sum())

            print(f"\nbase_data 中有订单(有 model)的组合数: {has_order_count:,}")
            print(f"base_data 中无订单(无 model)的组合数: {no_order_count:,}")

            if DEBUG:
                print_subtitle("无订单组合预览（只会生成未来数据）")
                no_order_preview = base_data[base_data['has_order'] == False].head(20)
                if len(no_order_preview) > 0:
                    print(no_order_preview.to_string(index=False))
                else:
                    print("没有无订单组合。")

            # 4. daily_sales
            print("\n[4/9] 计算每日销量与每日型号 (daily_sales + orders_for_hist)...")
            daily_history_query = f"""
                SELECT
                    tvc.shop,
                    tvc.country,
                    tvc.asin,
                    DATE(ol.order_date) AS sale_date,
                    COUNT(*) AS total_sales,
                    COALESCE(
                        MAX(tvc.asin_model),
                        SUBSTRING_INDEX(
                            GROUP_CONCAT(sk.model ORDER BY ol.order_date DESC SEPARATOR '|||'),
                            '|||',
                            1
                        )
                    ) AS model
                FROM {work_table} tvc
                STRAIGHT_JOIN shop s
                  ON s.short_name = tvc.shop
                STRAIGHT_JOIN order_list ol
                  ON ol.shop = s.name
                 AND ol.country_code = tvc.country
                 AND ol.asin = tvc.asin
                STRAIGHT_JOIN sku sk
                  ON sk.sku = ol.sku
                WHERE ol.order_date >= '{ORDER_START_DATE}'
                  AND ol.order_date <= CURDATE()
                  AND ol.status != 'Canceled'
                  AND ol.country_code != '' AND ol.country_code IS NOT NULL
                  AND ol.sku != '' AND ol.sku IS NOT NULL
                  AND ol.asin != '' AND ol.asin IS NOT NULL
                  AND (
                      tvc.asin_model IS NOT NULL
                      OR (sk.model != '' AND sk.model IS NOT NULL)
                  )
                GROUP BY tvc.shop, tvc.country, tvc.asin, DATE(ol.order_date)
            """
            daily_history = read_sql_logged(daily_history_query, conn, "daily_history")
            daily_sales = daily_history[[
                'shop', 'country', 'asin', 'sale_date', 'total_sales'
            ]].copy()

            print(f"daily_sales 记录数: {len(daily_sales):,}")
            print_df_preview(daily_sales, "daily_sales", 20)
            print_group_summary(daily_sales, ['shop'], "daily_sales 按 shop")
            print_group_summary(daily_sales, ['country'], "daily_sales 按 country")

            # 5. orders_for_hist
            print("\n[5/9] 生成历史数据 (historical_data - 订单)...")
            orders_for_hist = daily_history[[
                'shop', 'country', 'asin', 'sale_date', 'model'
            ]].rename(columns={'sale_date': 'order_date'}).copy()

            print(f"orders_for_hist 记录数: {len(orders_for_hist):,}")
            print_df_preview(orders_for_hist, "orders_for_hist", 20)

            historical_data = daily_sales.merge(
                orders_for_hist,
                left_on=['shop', 'country', 'asin', 'sale_date'],
                right_on=['shop', 'country', 'asin', 'order_date'],
                how='left'
            )

            historical_data['date'] = historical_data['sale_date']
            historical_data['week'] = historical_data['sale_date']
            historical_data['sales'] = historical_data['total_sales']
            historical_data['shop_country_asin_date'] = (
                historical_data['shop'].astype(str) + '_' +
                historical_data['country'].astype(str) + '_' +
                historical_data['asin'].astype(str) + '_' +
                pd.to_datetime(historical_data['sale_date']).dt.strftime('%Y%m%d')
            )

            historical_data = historical_data[[
                'shop_country_asin_date', 'asin', 'model', 'country', 'shop', 'date', 'week', 'sales'
            ]]

            print(f"订单历史数据记录数: {len(historical_data):,}")
            print_df_preview(historical_data, "historical_data", 20)
            print_group_summary(historical_data, ['shop'], "historical_data 按 shop")
            print_group_summary(historical_data, ['country'], "historical_data 按 country")

            # 6. Woot 历史
            print("\n[6/9] 生成 Woot 历史数据 (shop='woot')...")
            cursor.execute(f"""
                CREATE TEMPORARY TABLE {woot_asin_table} AS
                SELECT DISTINCT
                    ws.country,
                    ws.asin,
                    NULLIF(a.model, '') AS asin_model
                FROM woot_statistics ws
                INNER JOIN asin a
                    ON a.country = ws.country
                   AND a.asin = ws.asin
                   AND a.status IN ('新品', '重点', '普通')
                   AND COALESCE(a.maintenance_level, '') != '变体'
                WHERE ws.date >= '{ORDER_START_DATE}'
                  AND ws.date <= CURDATE()
                  AND ws.asin IS NOT NULL
                  AND ws.asin != ''
                  AND ws.country IS NOT NULL
                  AND ws.country != ''
                  AND ws.sales_volume > 0
            """)
            cursor.execute(f"""
                CREATE INDEX idx_woot_{work_suffix}_ca
                ON {woot_asin_table} (country, asin)
            """)
            cursor.execute(f"""
                CREATE INDEX idx_woot_{work_suffix}_asin
                ON {woot_asin_table} (asin)
            """)
            # MySQL 同一条查询不能重复打开同一临时表，创建独立副本供子查询使用。
            cursor.execute(f"""
                CREATE TEMPORARY TABLE {woot_asin_lookup_table} AS
                SELECT DISTINCT asin
                FROM {woot_asin_table}
            """)
            cursor.execute(f"""
                CREATE INDEX idx_woot_lookup_{work_suffix}_asin
                ON {woot_asin_lookup_table} (asin)
            """)

            woot_historical_query = f"""
                SELECT
                    'woot' AS shop,
                    ws.country,
                    ws.asin,
                    ws.date AS sale_date,
                    COALESCE(ws.sales_volume, 0) AS total_sales,
                    COALESCE(wa.asin_model, om.model) AS model
                FROM woot_statistics ws
                INNER JOIN {woot_asin_table} wa
                    ON wa.country = ws.country
                   AND wa.asin = ws.asin
                LEFT JOIN (
                    SELECT
                        ol.asin,
                        SUBSTRING_INDEX(
                            GROUP_CONCAT(sk.model ORDER BY ol.order_date DESC SEPARATOR '|||'),
                            '|||',
                            1
                        ) AS model
                    FROM order_list ol
                    JOIN (
                        SELECT DISTINCT asin
                        FROM {woot_asin_lookup_table}
                    ) wa2
                      ON wa2.asin = ol.asin
                    JOIN sku sk ON sk.sku = ol.sku
                    WHERE ol.asin IS NOT NULL
                      AND ol.asin != ''
                      AND ol.sku IS NOT NULL
                      AND ol.sku != ''
                      AND sk.model IS NOT NULL
                      AND sk.model != ''
                    GROUP BY ol.asin
                ) om
                  ON ws.asin = om.asin
                WHERE ws.date >= '{ORDER_START_DATE}'
                  AND ws.date <= CURDATE()
                  AND ws.asin IS NOT NULL
                  AND ws.asin != ''
                  AND ws.country IS NOT NULL
                  AND ws.country != ''
                  AND ws.sales_volume > 0
            """
            woot_historical_all = read_sql_logged(woot_historical_query, conn, "woot_historical_all")

            print(f"Woot 原始数据记录数: {len(woot_historical_all):,}")
            print_df_preview(woot_historical_all, "woot_historical_all", 20)

            # 用完删除中间表
            cursor.execute(f"DROP TEMPORARY TABLE IF EXISTS {work_table}")
            cursor.execute(f"DROP TEMPORARY TABLE IF EXISTS {woot_asin_table}")
            cursor.execute(f"DROP TEMPORARY TABLE IF EXISTS {woot_asin_lookup_table}")
            print(f"\n已删除临时中间表: {work_table}, {woot_asin_table}, {woot_asin_lookup_table}")

        woot_historical = woot_historical_all[woot_historical_all['model'].notna()].copy()
        print(f"过滤后 Woot 历史数据数: {len(woot_historical):,}")

        if len(woot_historical) > 0:
            woot_historical['date'] = woot_historical['sale_date']
            woot_historical['week'] = woot_historical['sale_date']
            woot_historical['sales'] = woot_historical['total_sales']
            woot_historical['shop_country_asin_date'] = (
                'woot_' +
                woot_historical['country'].astype(str) + '_' +
                woot_historical['asin'].astype(str) + '_' +
                pd.to_datetime(woot_historical['sale_date']).dt.strftime('%Y%m%d')
            )

            woot_historical = woot_historical[[
                'shop_country_asin_date', 'asin', 'model', 'country', 'shop', 'date', 'week', 'sales'
            ]]
        else:
            print("没有找到 Woot 历史数据。")
            woot_historical = pd.DataFrame(columns=[
                'shop_country_asin_date', 'asin', 'model', 'country', 'shop', 'date', 'week', 'sales'
            ])

        print_df_preview(woot_historical, "woot_historical", 20)
        print_group_summary(woot_historical, ['country'], "woot_historical 按 country")

        # 7. 订单未来
        print("\n[7/9] 生成订单未来数据 (future_data - 订单)...")
        future_data = expand_future_data(base_data[['shop', 'country', 'asin', 'model']].copy(), future_dates_df)

        print(f"订单未来数据记录数: {len(future_data):,}")
        print_df_preview(future_data, "future_data", 20)
        print_group_summary(future_data, ['shop'], "future_data 按 shop")
        print_group_summary(future_data, ['country'], "future_data 按 country")

        # 8. Woot 未来
        print("\n[8/9] 生成 Woot 未来数据...")
        if len(woot_historical) > 0:
            woot_base = woot_historical[['country', 'asin', 'model']].drop_duplicates().copy()
            woot_base['shop'] = 'woot'

            print(f"Woot 唯一组合数: {len(woot_base):,}")
            print_df_preview(woot_base, "woot_base", 20)

            woot_future_data = expand_future_data(
                woot_base[['shop', 'country', 'asin', 'model']].copy(),
                future_dates_df
            )

            print(f"Woot 未来数据记录数: {len(woot_future_data):,}")
            print_df_preview(woot_future_data, "woot_future_data", 20)
        else:
            print("没有 Woot 历史数据，因此不生成 Woot 未来数据。")
            woot_future_data = pd.DataFrame(columns=[
                'shop_country_asin_date', 'asin', 'model', 'country', 'shop', 'date', 'week', 'sales'
            ])

        # 9. 合并
        print("\n[9/9] 合并所有数据...")
        final_data = pd.concat([
            historical_data,
            woot_historical,
            future_data,
            woot_future_data
        ], ignore_index=True)

        final_data = final_data.sort_values(['date', 'shop_country_asin_date']).reset_index(drop=True)

        print_title("最终数据统计")
        print(f"订单历史数据: {len(historical_data):,}")
        print(f"Woot 历史数据: {len(woot_historical):,}")
        print(f"订单未来数据: {len(future_data):,}")
        print(f"Woot 未来数据: {len(woot_future_data):,}")
        print(f"最终总记录数: {len(final_data):,}")

        print_df_preview(final_data, "final_data", 30)
        print_group_summary(final_data[final_data['sales'].notna()], ['shop'], "final_data 历史数据按 shop")
        print_group_summary(final_data[final_data['sales'].isna()], ['shop'], "final_data 未来数据按 shop")

        duplicate_count = final_data.duplicated(subset=['shop_country_asin_date']).sum()
        print(f"\nshop_country_asin_date 重复数: {duplicate_count:,}")
        if duplicate_count > 0 and DEBUG:
            print_subtitle("重复主键预览")
            dup_df = final_data[final_data.duplicated(subset=['shop_country_asin_date'], keep=False)]
            print(dup_df.head(50).to_string(index=False))

        missing_model_count = int(final_data['model'].isna().sum())
        print(f"\nmodel 为空记录数: {missing_model_count:,}")
        if missing_model_count > 0 and DEBUG:
            print_subtitle("model 为空记录预览")
            print(final_data[final_data['model'].isna()].head(50).to_string(index=False))

        return final_data

    finally:
        # 发生异常时连接上下文会关闭，MySQL 会自动清理该连接创建的临时表。
        pass


# ================= 写库 =================
def update_to_daily_sales(df, table_name='daily_sales'):
    print_title(f"开始更新表: {table_name}", 60)

    with get_db_conn() as (conn, cursor):
        batch_size = 5000
        total_rows = len(df)
        total_batches = (total_rows + batch_size - 1) // batch_size

        print(f"开始批量插入/更新数据...")
        print(f"总记录数: {total_rows:,}")
        print(f"批次大小: {batch_size:,}")
        print(f"总批次数: {total_batches}")

        insert_sql = f"""
        INSERT INTO {table_name}
            (shop_country_asin_date, asin, model, country, shop, date, week, sales)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            asin=VALUES(asin),
            model=COALESCE(VALUES(model), model),
            country=VALUES(country),
            shop=VALUES(shop),
            date=VALUES(date),
            week=VALUES(week),
            sales=VALUES(sales)
        """

        for batch_num in range(total_batches):
            start_idx = batch_num * batch_size
            end_idx = min(start_idx + batch_size, total_rows)
            batch_df = df.iloc[start_idx:end_idx]

            params = []
            for row in batch_df.itertuples(index=False):
                params.append((
                    None if pd.isna(row.shop_country_asin_date) else str(row.shop_country_asin_date),
                    None if pd.isna(row.asin) else str(row.asin),
                    None if pd.isna(row.model) else str(row.model),
                    None if pd.isna(row.country) else str(row.country),
                    None if pd.isna(row.shop) else str(row.shop),
                    None if pd.isna(row.date) else str(row.date),
                    None if pd.isna(row.week) else str(row.week),
                    None if pd.isna(row.sales) else int(row.sales)
                ))

            cursor.executemany(insert_sql, params)

            if (batch_num + 1) % 10 == 0 or (batch_num + 1) == total_batches:
                print(f"进度: {batch_num + 1}/{total_batches} ({end_idx:,}/{total_rows:,} 条)")

        print("\n✓ 数据更新完成！")


# ================= 统计 =================
def get_statistics(table_name='daily_sales'):
    print_title("数据统计", 60)

    with get_db_conn() as (conn, cursor):
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        total = cursor.fetchone()[0]

        cursor.execute(f"SELECT COUNT(*) FROM {table_name} WHERE sales IS NOT NULL AND shop != '合计'")
        with_sales = cursor.fetchone()[0]

        cursor.execute(f"SELECT COUNT(*) FROM {table_name} WHERE sales IS NULL AND shop != '合计'")
        without_sales = cursor.fetchone()[0]

        cursor.execute(f"SELECT MIN(date), MAX(date) FROM {table_name}")
        min_date, max_date = cursor.fetchone()

        cursor.execute(f"""
            SELECT 
                COUNT(*) AS woot_records,
                SUM(COALESCE(sales, 0)) AS woot_sales
            FROM {table_name}
            WHERE shop = 'woot' AND sales IS NOT NULL
        """)
        woot_records, woot_sales = cursor.fetchone()

        print(f"表名: {table_name}")
        print(f"总记录数: {total:,}")
        print(f"历史数据(有销量): {with_sales:,}")
        print(f"未来数据(无销量): {without_sales:,}")
        print(f"日期范围: {min_date} ~ {max_date}")

        print(f"\nWoot 统计:")
        print(f"记录数: {0 if woot_records is None else woot_records:,}")
        print(f"销量: {0 if woot_sales is None else woot_sales:,}")


# ================= 主程序 =================
def main():
    start_time = datetime.now()

    try:
        print_title("SQL转Python - Daily Sales 数据生成（修复 MySQL 临时表 reopen 问题）", 80)
        print(f"执行时间: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")

        df = generate_sales_forecast()

        print_title("写入前最终校验", 80)
        print(f"最终 DataFrame 行数: {len(df):,}")
        print(f"历史数据条数: {len(df[df['sales'].notna()]):,}")
        print(f"未来数据条数: {len(df[df['sales'].isna()]):,}")
        print_df_preview(df, "待写入 final_data", 30)

        update_to_daily_sales(df)
        get_statistics()

        end_time = datetime.now()
        print_title(f"执行完成，总耗时: {(end_time - start_time).total_seconds():.2f} 秒", 80)

    except Exception as e:
        import traceback
        print_title("执行失败", 80)
        print(str(e))
        print(traceback.format_exc())
        raise
