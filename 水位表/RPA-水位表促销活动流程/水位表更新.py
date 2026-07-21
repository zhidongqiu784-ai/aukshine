# 使用提醒:
# 1. xbot包提供软件自动化、数据表格、Excel、日志、AI等功能
# 2. package包提供访问当前应用数据的功能，如获取元素、访问全局变量、获取资源文件等功能
# 3. 当此模块作为流程独立运行时执行main函数
# 4. 可视化流程中可以通过"调用模块"的指令使用此模块

import xbot
from xbot import print, sleep
from .import package
from .package import variables as glv

import mysql.connector
from contextlib import contextmanager


# ================= 数据库工具 =================

DB_CONF = {
    "host": glv.get("A_host"),
    "user": glv.get("A_user"),
    "password": glv.get("A_password"),
    "database": glv.get("A_nocobase"),
    "port": 3306
}


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


# ================= 通用执行方法 =================

def execute_sql(cursor, step_name, sql):
    """执行单个SQL步骤"""
    cursor.execute(sql)
    affected = cursor.rowcount
    print(f"{step_name}：影响行数 {affected}")
    return affected


def execute_sql_list(cursor, step_name, sql_list):
    """按顺序执行多个SQL步骤，只输出步骤汇总"""
    total = 0

    for sql in sql_list:
        cursor.execute(sql)
        affected = cursor.rowcount

        if affected and affected > 0:
            total += affected

    print(f"{step_name}：执行完成，累计影响行数 {total}")
    return total


# ================= 步骤1：更新分店铺基准销量 =================

def step_1_update_base_sales(cursor):
    sql = """
        UPDATE daily_sales ds
        JOIN (
            SELECT
                asin,
                country,
                date,
                SUM(sales) AS total_sales,
                MAX(coefficient) AS max_coefficient,
                SUM(sales) / NULLIF(MAX(coefficient), 0) AS calculated_base_sales
            FROM daily_sales
            WHERE shop != '合计'
            GROUP BY asin, country, date
        ) agg
            ON ds.asin = agg.asin
           AND ds.country = agg.country
           AND ds.date = agg.date
        SET ds.base_sales = agg.calculated_base_sales
        WHERE ds.shop != '合计'
          AND ds.date > DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    """
    return execute_sql(cursor, "步骤1 更新分店铺基准销量", sql)


# ================= 步骤2：更新分店铺未来加权基准销量 =================

def step_2_update_shop_weighted_sales(cursor):
    sql = """
        UPDATE daily_sales AS d
        JOIN (
            WITH base_sales_calc AS (
                SELECT
                    asin,
                    country,
                    date,
                    SUM(sales) / NULLIF(MAX(coefficient), 0) AS daily_base_sales
                FROM daily_sales
                WHERE shop <> '合计'
                  AND date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                              AND DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                GROUP BY asin, country, date
            ),
            sales_history AS (
                SELECT
                    asin,
                    country,
                    daily_base_sales,
                    ROW_NUMBER() OVER (PARTITION BY asin, country ORDER BY date DESC) AS row_num,
                    COUNT(*) OVER (PARTITION BY asin, country) AS total_count
                FROM base_sales_calc
            ),
            weighted_avg AS (
                SELECT
                    asin,
                    country,
                    ROUND(
                        CASE
                            WHEN total_count BETWEEN 1 AND 3 THEN
                                AVG(daily_base_sales)
                            WHEN total_count BETWEEN 4 AND 7 THEN
                                (
                                    COALESCE(AVG(CASE WHEN row_num BETWEEN 1 AND CEIL(total_count * 0.3) THEN daily_base_sales END), 0) * 0.7
                                    + COALESCE(AVG(CASE WHEN row_num > CEIL(total_count * 0.3) THEN daily_base_sales END), 0) * 0.3
                                )
                            WHEN total_count BETWEEN 8 AND 15 THEN
                                (
                                    COALESCE(AVG(CASE WHEN row_num BETWEEN 1 AND CEIL(total_count * 0.33) THEN daily_base_sales END), 0) * 0.6
                                    + COALESCE(AVG(CASE WHEN row_num BETWEEN CEIL(total_count * 0.33) + 1 AND CEIL(total_count * 0.66) THEN daily_base_sales END), 0) * 0.3
                                    + COALESCE(AVG(CASE WHEN row_num > CEIL(total_count * 0.66) THEN daily_base_sales END), 0) * 0.1
                                )
                            WHEN total_count BETWEEN 16 AND 29 THEN
                                (
                                    COALESCE(AVG(CASE WHEN row_num BETWEEN 1 AND 7 THEN daily_base_sales END), 0) * 0.55
                                    + COALESCE(AVG(CASE WHEN row_num BETWEEN 8 AND 15 THEN daily_base_sales END), 0) * 0.35
                                    + COALESCE(AVG(CASE WHEN row_num BETWEEN 16 AND total_count THEN daily_base_sales END), 0) * 0.1
                                )
                            ELSE
                                (
                                    COALESCE(AVG(CASE WHEN row_num BETWEEN 1 AND 7 THEN daily_base_sales END), 0) * 0.5
                                    + COALESCE(AVG(CASE WHEN row_num BETWEEN 8 AND 15 THEN daily_base_sales END), 0) * 0.3
                                    + COALESCE(AVG(CASE WHEN row_num BETWEEN 16 AND 30 THEN daily_base_sales END), 0) * 0.2
                                )
                        END
                    , 1) AS weighted_sales_value
                FROM sales_history
                GROUP BY asin, country
            )
            SELECT
                d2.asin,
                d2.country,
                d2.date,
                w.weighted_sales_value
            FROM daily_sales d2
            JOIN weighted_avg w
                ON d2.asin = w.asin
               AND d2.country = w.country
            WHERE d2.date IS NOT NULL
        ) AS r
            ON r.asin = d.asin
           AND r.country = d.country
           AND r.date = d.date
        SET d.weighted_sales = r.weighted_sales_value
        WHERE d.shop <> '合计'
          AND d.date >= CURDATE()
    """
    return execute_sql(cursor, "步骤2 更新分店铺加权基准销量", sql)


# ================= 步骤3：分店铺库存推演 =================

def step_3_update_shop_inventory(cursor):
    sql_list = [
        """
        SET SESSION cte_max_recursion_depth = 1000
        """,
        """
        DROP TEMPORARY TABLE IF EXISTS temp_inventory_prediction
        """,
        """
        CREATE TEMPORARY TABLE temp_inventory_prediction AS
        WITH RECURSIVE inventory_calc AS (
            SELECT
                asin,
                country,
                shop,
                `date`,
                CAST(inventory AS SIGNED) + CAST(COALESCE(`add`, 0) AS SIGNED) AS calc_inv,
                CAST(COALESCE(maybe_sales, 0) AS SIGNED) AS m_sales,
                CAST(0 AS SIGNED) AS m_add
            FROM daily_sales
            WHERE `date` = CURDATE()
              AND shop <> '合计'

            UNION ALL

            SELECT
                d.asin,
                d.country,
                d.shop,
                d.date,
                CASE
                    WHEN COALESCE(d.`add`, 0) > 0
                         AND (f.calc_inv - f.m_sales) < 0
                    THEN CAST(d.`add` AS SIGNED)
                    ELSE (f.calc_inv - f.m_sales) + CAST(COALESCE(d.`add`, 0) AS SIGNED)
                END AS calc_inv,
                CAST(COALESCE(d.maybe_sales, 0) AS SIGNED),
                CAST(COALESCE(d.`add`, 0) AS SIGNED)
            FROM daily_sales d
            INNER JOIN inventory_calc f
                ON d.asin = f.asin
               AND d.country = f.country
               AND d.shop = f.shop
               AND d.date = DATE_ADD(f.date, INTERVAL 1 DAY)
            WHERE d.shop <> '合计'
        )
        SELECT asin, country, shop, `date`, calc_inv
        FROM inventory_calc
        """,
        """
        ALTER TABLE temp_inventory_prediction
        ADD INDEX idx_lookup (`date`, shop, asin, country)
        """,
        """
        UPDATE daily_sales AS cur
        JOIN temp_inventory_prediction AS x
            ON x.`date` = cur.`date`
           AND x.shop = cur.shop
           AND x.asin = cur.asin
           AND x.country = cur.country
        SET
            cur.inventory = x.calc_inv,
            cur.days_for_sale = CASE
                WHEN x.calc_inv <= 0 THEN 0
                WHEN cur.weighted_sales > 0 THEN FLOOR(x.calc_inv / cur.weighted_sales)
                ELSE 0
            END
        WHERE cur.shop <> '合计'
          AND cur.`date` >= CURDATE()
        """,
        """
        DROP TEMPORARY TABLE IF EXISTS temp_sale_inventory_prediction
        """,
        """
        CREATE TEMPORARY TABLE temp_sale_inventory_prediction AS
        WITH RECURSIVE sale_inventory_calc AS (
            SELECT
                tip.asin,
                tip.country,
                tip.shop,
                tip.`date`,
                tip.calc_inv AS sale_calc_inv,
                CAST(
                    COALESCE(
                        CASE
                            WHEN d.sale_maybe_sales IS NOT NULL THEN d.sale_maybe_sales
                            ELSE d.maybe_sales
                        END,
                        0
                    ) AS SIGNED
                ) AS s_sales,
                CAST(0 AS SIGNED) AS s_add
            FROM temp_inventory_prediction tip
            JOIN daily_sales d
                ON d.`date` = tip.`date`
               AND d.asin = tip.asin
               AND d.country = tip.country
               AND d.shop = tip.shop
            WHERE tip.`date` = CURDATE()

            UNION ALL

            SELECT
                d.asin,
                d.country,
                d.shop,
                d.date,
                CASE
                    WHEN COALESCE(d.`add`, 0) > 0
                         AND (f.sale_calc_inv - f.s_sales) < 0
                    THEN CAST(d.`add` AS SIGNED)
                    ELSE (f.sale_calc_inv - f.s_sales) + CAST(COALESCE(d.`add`, 0) AS SIGNED)
                END AS sale_calc_inv,
                CAST(
                    COALESCE(
                        CASE
                            WHEN d.sale_maybe_sales IS NOT NULL THEN d.sale_maybe_sales
                            ELSE d.maybe_sales
                        END,
                        0
                    ) AS SIGNED
                ) AS s_sales,
                CAST(COALESCE(d.`add`, 0) AS SIGNED) AS s_add
            FROM daily_sales d
            INNER JOIN sale_inventory_calc f
                ON d.asin = f.asin
               AND d.country = f.country
               AND d.shop = f.shop
               AND d.date = DATE_ADD(f.date, INTERVAL 1 DAY)
            WHERE d.shop <> '合计'
        )
        SELECT asin, country, shop, `date`, sale_calc_inv
        FROM sale_inventory_calc
        """,
        """
        ALTER TABLE temp_sale_inventory_prediction
        ADD INDEX idx_sale_lookup (`date`, shop, asin, country)
        """,
        """
        UPDATE daily_sales AS cur
        JOIN temp_sale_inventory_prediction AS x
            ON x.`date` = cur.`date`
           AND x.shop = cur.shop
           AND x.asin = cur.asin
           AND x.country = cur.country
        SET
            cur.sale_inventory = x.sale_calc_inv,
            cur.estimate_days_for_sales = CASE
                WHEN x.sale_calc_inv <= 0 THEN 0
                WHEN cur.weighted_sales > 0 THEN FLOOR(x.sale_calc_inv / cur.weighted_sales)
                ELSE 0
            END
        WHERE cur.shop <> '合计'
          AND cur.`date` >= CURDATE()
        """,
        """
        DROP TEMPORARY TABLE IF EXISTS temp_on_the_way_calc
        """,
        """
        CREATE TEMPORARY TABLE temp_on_the_way_calc AS
        SELECT
            asin,
            country,
            shop,
            `date`,
            COALESCE(SUM(`add`) OVER (
                PARTITION BY asin, country, shop
                ORDER BY `date`
                ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING
            ), 0) AS total_add
        FROM daily_sales
        WHERE `date` >= CURDATE() - INTERVAL 30 DAY
          AND shop <> '合计'
        """,
        """
        ALTER TABLE temp_on_the_way_calc
        ADD INDEX idx_join (asin, country, shop, `date`)
        """,
        """
        UPDATE daily_sales AS tgt
        JOIN temp_on_the_way_calc AS src
            ON src.asin = tgt.asin
           AND src.country = tgt.country
           AND src.shop = tgt.shop
           AND src.`date` = tgt.`date`
        SET tgt.on_the_way = src.total_add
        WHERE tgt.shop <> '合计'
          AND tgt.`date` >= CURDATE() - INTERVAL 30 DAY
        """,
        """
        DROP TEMPORARY TABLE IF EXISTS temp_inventory_prediction
        """,
        """
        DROP TEMPORARY TABLE IF EXISTS temp_sale_inventory_prediction
        """,
        """
        DROP TEMPORARY TABLE IF EXISTS temp_on_the_way_calc
        """
    ]
    return execute_sql_list(cursor, "步骤3 分店铺库存推演", sql_list)


# ================= 步骤4：生成或更新合计行 =================

def step_4_upsert_summary_rows(cursor):
    sql = """
        -- 工作流：更新水位表
        -- 节点序号：6
        -- 节点名称：为同一ASIN、国家、日期的所有店铺数据创建汇总记录（"合计"记录）
        -- 节点说明：
        -- 1、汇总补货、库存（取基础库存各店铺的可售+待调仓的合计）、在途
        -- 2、基准销量：合并销量/类型系数（最大值）
        -- 3、加权基准销量：按过去30天的平均值，但是过去7天的权重为50%，过去8-15天的权重30%，过去16-30天的权重为20%
        -- 4、兼容领星昨日销量延迟：昨天仅回补销量和基准销量；其他汇总字段及加权销量仅更新今天及以后

        INSERT INTO daily_sales (
            asin, country, shop, sales, model, shop_country_asin_date, date,
            inventory, sale_inventory, coefficient, week, base_sales, weighted_sales, days_for_sale,
            `add`, on_the_way, maybe_sales, overseas_warehouse_test_product,
            overseas_warehouse_new_product, type, sale_maybe_sales
        )
        WITH
        filtered_sales_with_type AS (
            SELECT 
                asin, country, date, sales, inventory, coefficient, `add`, on_the_way,
                model, week, overseas_warehouse_test_product, overseas_warehouse_new_product, 
                maybe_sales, sale_inventory, sale_maybe_sales, type, sales_store,
                FIRST_VALUE(type) OVER (PARTITION BY asin, country, date ORDER BY coefficient DESC, type DESC) AS max_coeff_type
            FROM daily_sales
            WHERE shop <> '合计'
        ),
        summary_sales_store AS (
            SELECT asin, country, date, sales_store
            FROM daily_sales
            WHERE shop = '合计'
              AND sales_store IS NOT NULL
        ),
        real_inventory_agg AS (
            SELECT
                asin,
                country,
                date,
                SUM(COALESCE(afn_fulfillable_quantity, 0) + COALESCE(reserved_fc_transfers, 0)) AS calculated_inv,
                SUM(COALESCE(afn_fulfillable_quantity, 0) + COALESCE(reserved_fc_transfers, 0)) AS calculated_sale_inv  -- ✅ 新增
            FROM inventory_base
            WHERE date >= (SELECT MIN(date) FROM daily_sales WHERE shop <> '合计')
            GROUP BY asin, country, date
        ),
        shop_combined AS (
            SELECT
                asin, country, date,
                SUM(`add`) AS total_add,
                SUM(on_the_way) AS total_on_the_way,
                SUM(sales) AS total_sales,
                SUM(COALESCE(maybe_sales, 0)) AS total_maybe_sales,
                MAX(coefficient) AS max_coefficient,
                MAX(max_coeff_type) AS max_coeff_type,
                MAX(model) AS model,
                MAX(week) AS week,
                MAX(overseas_warehouse_test_product) AS overseas_warehouse_test_product,
                MAX(overseas_warehouse_new_product) AS overseas_warehouse_new_product,
                SUM(COALESCE(sale_inventory, 0)) AS total_sale_inventory,
                SUM(sale_maybe_sales) AS total_sale_maybe_sales,
                SUM(CASE WHEN sale_maybe_sales > 0 THEN COALESCE(maybe_sales, 0) ELSE 0 END) AS total_maybe_sales_filtered
            FROM filtered_sales_with_type
            GROUP BY asin, country, date
        ),
        base_calculated AS (
            SELECT
                sc.*,
                COALESCE(inv.calculated_inv, 0) AS final_inventory,
                COALESCE(inv.calculated_sale_inv, 0) AS final_sale_inventory,  -- ✅ 新增
                sc.total_sales / NULLIF(sc.max_coefficient, 0) AS daily_base_sales
            FROM shop_combined sc
            LEFT JOIN real_inventory_agg inv
                ON sc.asin = inv.asin AND sc.country = inv.country AND sc.date = inv.date
        ),
        sales_history AS (
            SELECT asin, country, daily_base_sales,
                   ROW_NUMBER() OVER (PARTITION BY asin, country ORDER BY date DESC) AS row_num,
                   COUNT(*) OVER (PARTITION BY asin, country) AS total_count
            FROM base_calculated
            WHERE date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        ),
        weighted_sales_current AS (
            SELECT
                asin, country,
                ROUND(
                    CASE
                        WHEN total_count BETWEEN 1 AND 3 THEN AVG(daily_base_sales)
                        WHEN total_count BETWEEN 4 AND 7 THEN
                            (AVG(CASE WHEN row_num <= CEIL(total_count*0.3) THEN daily_base_sales END)*0.7
                             + AVG(CASE WHEN row_num >  CEIL(total_count*0.3) THEN daily_base_sales END)*0.3)
                        WHEN total_count BETWEEN 8 AND 15 THEN
                            (AVG(CASE WHEN row_num <= CEIL(total_count*0.33) THEN daily_base_sales END)*0.6
                             + AVG(CASE WHEN row_num BETWEEN CEIL(total_count*0.33)+1 AND CEIL(total_count*0.66) THEN daily_base_sales END)*0.3
                             + AVG(CASE WHEN row_num >  CEIL(total_count*0.66) THEN daily_base_sales END)*0.1)
                        ELSE
                            (AVG(CASE WHEN row_num <= 7 THEN daily_base_sales END)*0.5
                             + AVG(CASE WHEN row_num BETWEEN 8 AND 15 THEN daily_base_sales END)*0.3
                             + AVG(CASE WHEN row_num BETWEEN 16 AND 30 THEN daily_base_sales END)*0.2)
                    END, 1
                ) AS weighted_sales
            FROM sales_history
            GROUP BY asin, country
        )
        SELECT
            bc.asin, bc.country, '合计', bc.total_sales, bc.model,
            CONCAT('合计_', bc.country, '_', bc.asin, '_', REPLACE(bc.date, '-', '')), bc.date,

            bc.final_inventory,
            bc.final_sale_inventory,  -- ✅ 替换原来的 bc.total_sale_inventory

            ROUND(bc.max_coefficient, 2), bc.week, bc.daily_base_sales,

            COALESCE(
                w.weighted_sales,
                ROUND(bc.total_maybe_sales / NULLIF(bc.max_coefficient, 0), 1),
                0
            ) AS weighted_sales,

            CASE
                WHEN bc.final_inventory <= 0 THEN 0
                WHEN COALESCE(
                         w.weighted_sales,
                         ROUND(bc.total_maybe_sales / NULLIF(bc.max_coefficient, 0), 1),
                         0
                     ) > 0
                THEN LEAST(
                    FLOOR(
                        bc.final_inventory / COALESCE(
                            w.weighted_sales,
                            ROUND(bc.total_maybe_sales / NULLIF(bc.max_coefficient, 0), 1),
                            0
                        )
                    ),
                    65535
                )
                ELSE NULL
            END AS days_for_sale,

            bc.total_add, bc.total_on_the_way,

            FLOOR(
                bc.max_coefficient * COALESCE(
                    w.weighted_sales,
                    ROUND(bc.total_maybe_sales / NULLIF(bc.max_coefficient, 0), 1),
                    0
                )
            ) AS maybe_sales,

            bc.overseas_warehouse_test_product, bc.overseas_warehouse_new_product, bc.max_coeff_type,

            COALESCE((
                SELECT ds.sale_maybe_sales
                FROM daily_sales ds
                INNER JOIN summary_sales_store sss
                    ON sss.asin = bc.asin
                   AND sss.country = bc.country
                   AND sss.date = bc.date
                WHERE ds.asin = bc.asin
                  AND ds.country = bc.country
                  AND ds.date = bc.date
                  AND ds.shop = sss.sales_store
                LIMIT 1
            ), 0) AS sale_maybe_sales

        FROM base_calculated bc
        LEFT JOIN weighted_sales_current w
            ON bc.asin = w.asin AND bc.country = w.country

        ON DUPLICATE KEY UPDATE
            daily_sales.sales =
                CASE
                    WHEN VALUES(date) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN VALUES(sales)
                    ELSE daily_sales.sales
                END,
            daily_sales.model =
                CASE
                    WHEN VALUES(date) >= CURDATE() THEN VALUES(model)
                    ELSE daily_sales.model
                END,
            daily_sales.coefficient =
                CASE
                    WHEN VALUES(date) >= CURDATE() THEN VALUES(coefficient)
                    ELSE daily_sales.coefficient
                END,
            daily_sales.base_sales =
                CASE
                    WHEN VALUES(date) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN VALUES(base_sales)
                    ELSE daily_sales.base_sales
                END,
            daily_sales.type =
                CASE
                    WHEN VALUES(date) >= CURDATE() THEN VALUES(type)
                    ELSE daily_sales.type
                END,

            daily_sales.inventory =
                CASE
                    WHEN VALUES(date) >= CURDATE() THEN VALUES(inventory)
                    ELSE daily_sales.inventory
                END,

            daily_sales.sale_inventory =
                CASE
                    WHEN VALUES(date) >= CURDATE() THEN VALUES(sale_inventory)
                    ELSE daily_sales.sale_inventory
                END,

            daily_sales.maybe_sales =
                CASE
                    WHEN VALUES(date) >= CURDATE() THEN VALUES(maybe_sales)
                    ELSE daily_sales.maybe_sales
                END,

            daily_sales.sale_maybe_sales =
                CASE
                    WHEN VALUES(date) >= CURDATE() THEN VALUES(sale_maybe_sales)
                    ELSE daily_sales.sale_maybe_sales
                END,

            daily_sales.weighted_sales =
                CASE
                    WHEN VALUES(date) >= CURDATE() THEN VALUES(weighted_sales)
                    ELSE daily_sales.weighted_sales
                END,

            daily_sales.`add` =
                CASE
                    WHEN VALUES(date) >= CURDATE() THEN VALUES(`add`)
                    ELSE daily_sales.`add`
                END,

            daily_sales.on_the_way =
                CASE
                    WHEN VALUES(date) >= CURDATE() THEN VALUES(on_the_way)
                    ELSE daily_sales.on_the_way
                END,

            daily_sales.overseas_warehouse_test_product =
                CASE
                    WHEN VALUES(date) >= CURDATE() THEN VALUES(overseas_warehouse_test_product)
                    ELSE daily_sales.overseas_warehouse_test_product
                END,

            daily_sales.overseas_warehouse_new_product =
                CASE
                    WHEN VALUES(date) >= CURDATE() THEN VALUES(overseas_warehouse_new_product)
                    ELSE daily_sales.overseas_warehouse_new_product
                END;
    """
    return execute_sql(cursor, "步骤4 生成或更新合计行", sql)


# ================= 步骤4-1：基于合计行推演BD预测 =================

def step_4_1_update_summary_bd_prediction(cursor):
    sql_list = [
        """
        SET SESSION cte_max_recursion_depth = 1000
        """,
        """
        DROP TEMPORARY TABLE IF EXISTS temp_summary_bd_prediction_days
        """,
        """
        CREATE TEMPORARY TABLE temp_summary_bd_prediction_days AS
        WITH RECURSIVE
        real_bd_days AS (
            SELECT
                asin,
                country,
                `date`,
                CASE
                    WHEN country IN ('DE', 'FR', 'ES', 'IT', 'UK') THEN 8
                    ELSE 22
                END AS gap_days,
                DATE_SUB(
                    `date`,
                    INTERVAL ROW_NUMBER() OVER (
                        PARTITION BY asin, country
                        ORDER BY `date`
                    ) DAY
                ) AS grp_key
            FROM daily_sales ds
            WHERE shop = '合计'
              AND type IS NOT NULL
              AND type NOT LIKE '%预测%'
              AND EXISTS (
                  SELECT 1
                  FROM datetypetime dtt
                  WHERE dtt.daytype IS NOT NULL
                    AND dtt.daytype LIKE 'BD%'
                    AND FIND_IN_SET(dtt.daytype, REPLACE(ds.type, '、', ',')) > 0
                      AND FIND_IN_SET(ds.country, dtt.country) > 0
              )
              AND asin IS NOT NULL
              AND asin != ''
              AND country IN ('US', 'CA', 'JP', 'DE', 'FR', 'ES', 'IT', 'UK')
              AND `date` BETWEEN DATE_SUB(CURDATE(), INTERVAL 365 DAY)
                              AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
        ),
        real_bd_segments AS (
            SELECT
                asin,
                country,
                MIN(`date`) AS bd_start_date,
                MAX(`date`) AS bd_end_date,
                MAX(gap_days) AS gap_days
            FROM real_bd_days
            GROUP BY asin, country, grp_key
        ),
        last_bd AS (
            SELECT
                real_bd_segments.*,
                ROW_NUMBER() OVER (
                    PARTITION BY asin, country
                    ORDER BY bd_end_date DESC, bd_start_date DESC
                ) AS rn
            FROM real_bd_segments
        ),
        predicted_bd AS (
            SELECT
                asin,
                country,
                gap_days,
                DATE_ADD(bd_end_date, INTERVAL gap_days DAY) AS pred_start_date
            FROM last_bd
            WHERE rn = 1
        
            UNION ALL
        
            SELECT
                asin,
                country,
                gap_days,
                DATE_ADD(pred_start_date, INTERVAL (13 + gap_days) DAY) AS pred_start_date
            FROM predicted_bd
            WHERE pred_start_date <= DATE_ADD(CURDATE(), INTERVAL 180 DAY)
        ),
        blocked_days AS (
            SELECT
                asin,
                country,
                type,
                `date`,
                DATE_SUB(
                    `date`,
                    INTERVAL ROW_NUMBER() OVER (
                        PARTITION BY asin, country, type
                        ORDER BY `date`
                    ) DAY
                ) AS grp_key
            FROM daily_sales ds
            WHERE shop = '合计'
              AND type IS NOT NULL
              AND type NOT LIKE '%预测%'
              AND EXISTS (
                  SELECT 1
                  FROM datetypetime dtt
                  WHERE dtt.daytype IS NOT NULL
                    AND FIND_IN_SET(dtt.daytype, REPLACE(ds.type, '、', ',')) > 0
                    AND (
                           dtt.daytype LIKE 'BD%'
                        OR dtt.daytype LIKE 'LD%'
                        OR dtt.daytype_category = '专享类型'
                    )
                      AND FIND_IN_SET(ds.country, dtt.country) > 0
              )
              AND `date` BETWEEN DATE_SUB(CURDATE(), INTERVAL 365 DAY)
                              AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
        ),
        blocked_segments AS (
            SELECT
                asin,
                country,
                MIN(`date`) AS block_start_date,
                MAX(`date`) AS block_end_date
            FROM blocked_days
            GROUP BY asin, country, type, grp_key
        ),
        valid_predicted_bd AS (
            SELECT
                p.asin,
                p.country,
                p.pred_start_date,
                DATE_ADD(p.pred_start_date, INTERVAL 13 DAY) AS pred_end_date
            FROM predicted_bd p
            WHERE p.pred_start_date BETWEEN CURDATE()
                                        AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
              AND NOT EXISTS (
                  SELECT 1
                  FROM blocked_segments bs
                  WHERE bs.asin = p.asin
                    AND bs.country = p.country
                    AND (
                        (
                            bs.block_start_date <= DATE_ADD(p.pred_start_date, INTERVAL 13 DAY)
                            AND bs.block_end_date >= p.pred_start_date
                        )
                        OR ABS(DATEDIFF(bs.block_start_date, p.pred_start_date)) <= 7
                    )
              )
        ),
        day_offsets AS (
            SELECT 0 AS day_offset
            UNION ALL
            SELECT day_offset + 1
            FROM day_offsets
            WHERE day_offset < 13
        )
        SELECT
            vpb.asin,
            vpb.country,
            DATE_ADD(vpb.pred_start_date, INTERVAL day_offsets.day_offset DAY) AS pred_date
        FROM valid_predicted_bd vpb
        INNER JOIN day_offsets ON 1 = 1
        WHERE DATE_ADD(vpb.pred_start_date, INTERVAL day_offsets.day_offset DAY)
              BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
        """,
        """
        ALTER TABLE temp_summary_bd_prediction_days
        ADD INDEX idx_summary_pred (asin, country, pred_date)
        """,
        """
        UPDATE daily_sales ds
        INNER JOIN temp_summary_bd_prediction_days pred
            ON ds.asin = pred.asin
           AND ds.country = pred.country
           AND ds.date = pred.pred_date
        SET ds.type = CASE
            WHEN ds.type IS NULL OR TRIM(ds.type) = '' THEN 'BD（预测）'
            WHEN FIND_IN_SET('BD（预测）', REPLACE(ds.type, '、', ',')) > 0 THEN ds.type
            ELSE CONCAT(ds.type, '、BD（预测）')
        END
        WHERE ds.shop = '合计'
          AND (
              ds.type IS NULL
              OR TRIM(ds.type) = ''
              OR NOT EXISTS (
                  SELECT 1
                  FROM datetypetime dtt
                  WHERE dtt.daytype IS NOT NULL
                    AND FIND_IN_SET(dtt.daytype, REPLACE(ds.type, '、', ',')) > 0
                    AND (
                           dtt.daytype LIKE 'BD%'
                        OR dtt.daytype LIKE 'LD%'
                        OR dtt.daytype_category = '专享类型'
                    )
                      AND FIND_IN_SET(ds.country, dtt.country) > 0
              )
          )
          AND ds.date BETWEEN CURDATE()
                          AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
        """,
        """
        WITH RECURSIVE prediction_type_parts AS (
            SELECT
                asin,
                country,
                shop,
                `date`,
                type,
                SUBSTRING_INDEX(type, '、', 1) AS part_type,
                CASE
                    WHEN type LIKE '%、%' THEN SUBSTRING(
                        type,
                        CHAR_LENGTH(SUBSTRING_INDEX(type, '、', 1)) + 2
                    )
                    ELSE ''
                END AS rest_type
            FROM daily_sales
            WHERE shop = '合计'
              AND FIND_IN_SET('BD（预测）', REPLACE(type, '、', ',')) > 0
              AND `date` BETWEEN CURDATE()
                               AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
        
            UNION ALL
        
            SELECT
                asin,
                country,
                shop,
                `date`,
                type,
                SUBSTRING_INDEX(rest_type, '、', 1) AS part_type,
                CASE
                    WHEN rest_type LIKE '%、%' THEN SUBSTRING(
                        rest_type,
                        CHAR_LENGTH(SUBSTRING_INDEX(rest_type, '、', 1)) + 2
                    )
                    ELSE ''
                END AS rest_type
            FROM prediction_type_parts
            WHERE rest_type != ''
        ),
        prediction_coefficient_calc AS (
            SELECT
                tp.asin,
                tp.country,
                tp.shop,
                tp.`date`,
                tp.type,
                EXP(SUM(LN(sc.coefficient))) AS new_coefficient,
                COUNT(*) AS part_count,
                SUM(
                    CASE
                        WHEN sc.coefficient IS NOT NULL AND sc.coefficient > 0 THEN 1
                        ELSE 0
                    END
                ) AS matched_count
            FROM prediction_type_parts tp
            LEFT JOIN sales_coefficient sc
                ON tp.asin = sc.asin
               AND tp.country = sc.country
               AND sc.type = CASE
                   WHEN tp.part_type = 'BD（预测）' THEN 'BD'
                   ELSE tp.part_type
               END
            GROUP BY
                tp.asin,
                tp.country,
                tp.shop,
                tp.`date`,
                tp.type
        )
        UPDATE daily_sales ds
        INNER JOIN prediction_coefficient_calc pcc
            ON ds.asin = pcc.asin
           AND ds.country = pcc.country
           AND ds.shop = pcc.shop
           AND ds.`date` = pcc.`date`
           AND ds.type = pcc.type
        SET ds.coefficient = pcc.new_coefficient
        WHERE pcc.part_count = pcc.matched_count
        """,
        """
        UPDATE daily_sales
        SET maybe_sales = weighted_sales * coefficient
        WHERE shop = '合计'
          AND FIND_IN_SET('BD（预测）', REPLACE(type, '、', ',')) > 0
          AND date BETWEEN CURDATE()
                      AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
        """,
        """
        DROP TEMPORARY TABLE IF EXISTS temp_summary_bd_prediction_days
        """
    ]
    return execute_sql_list(cursor, "步骤4-1 合计行BD预测", sql_list)

# ================= 步骤5：修正合计行库存结余 =================

def step_5_fix_summary_inventory(cursor):
    sql_list = [
        """
        SET SESSION cte_max_recursion_depth = 2000
        """,
        """
        DROP TEMPORARY TABLE IF EXISTS temp_inventory_simulation
        """,
        """
        CREATE TEMPORARY TABLE temp_inventory_simulation AS
        WITH RECURSIVE total_calc AS (
            SELECT
                asin,
                country,
                shop,
                `date`,
                CAST(inventory AS SIGNED) + CAST(COALESCE(`add`, 0) AS SIGNED) AS calc_inv,
                CAST(COALESCE(maybe_sales, 0) AS SIGNED) AS demand,
                CAST(COALESCE(`add`, 0) AS SIGNED) AS replenishment
            FROM daily_sales
            WHERE `date` = CURDATE()
              AND shop = '合计'

            UNION ALL

            SELECT
                d.asin,
                d.country,
                d.shop,
                d.`date`,
                CASE
                    WHEN (f.calc_inv - f.demand) < 0
                         AND CAST(COALESCE(d.`add`, 0) AS SIGNED) > 0
                    THEN CAST(COALESCE(d.`add`, 0) AS SIGNED)
                    ELSE f.calc_inv - f.demand + CAST(COALESCE(d.`add`, 0) AS SIGNED)
                END AS calc_inv,
                CAST(COALESCE(d.maybe_sales, 0) AS SIGNED) AS demand,
                CAST(COALESCE(d.`add`, 0) AS SIGNED) AS replenishment
            FROM daily_sales d
            INNER JOIN total_calc f
                ON d.asin = f.asin
               AND d.country = f.country
               AND d.shop = f.shop
               AND d.`date` = DATE_ADD(f.`date`, INTERVAL 1 DAY)
            WHERE d.shop = '合计'
        )
        SELECT * FROM total_calc
        """,
        """
        ALTER TABLE temp_inventory_simulation
        ADD INDEX idx_update (`date`, asin, country)
        """,
        """
        UPDATE daily_sales AS cur
        JOIN temp_inventory_simulation AS x
            ON x.`date` = cur.`date`
           AND x.asin = cur.asin
           AND x.country = cur.country
        SET
            cur.inventory = x.calc_inv,
            cur.days_for_sale = CASE
                WHEN x.calc_inv <= 0 THEN 0
                WHEN cur.weighted_sales > 0 THEN FLOOR(x.calc_inv / cur.weighted_sales)
                ELSE 0
            END
        WHERE cur.shop = '合计'
          AND cur.`date` >= CURDATE()
        """,
        """
        DROP TEMPORARY TABLE IF EXISTS temp_inventory_simulation
        """,
        """
        DROP TEMPORARY TABLE IF EXISTS temp_sale_inventory_simulation
        """,
        """
        CREATE TEMPORARY TABLE temp_sale_inventory_simulation AS
        WITH RECURSIVE sale_total_calc AS (
            SELECT
                asin,
                country,
                shop,
                `date`,
                CAST(sale_inventory AS SIGNED) + CAST(COALESCE(`add`, 0) AS SIGNED) AS sale_calc_inv,
                CAST(COALESCE(sale_maybe_sales, maybe_sales, 0) AS SIGNED) AS sale_demand,
                CAST(COALESCE(`add`, 0) AS SIGNED) AS replenishment
            FROM daily_sales
            WHERE `date` = CURDATE()
              AND shop = '合计'

            UNION ALL

            SELECT
                d.asin,
                d.country,
                d.shop,
                d.`date`,
                CASE
                    WHEN (f.sale_calc_inv - f.sale_demand) < 0
                         AND CAST(COALESCE(d.`add`, 0) AS SIGNED) > 0
                    THEN CAST(COALESCE(d.`add`, 0) AS SIGNED)
                    ELSE f.sale_calc_inv - f.sale_demand + CAST(COALESCE(d.`add`, 0) AS SIGNED)
                END AS sale_calc_inv,
                CAST(COALESCE(d.sale_maybe_sales, d.maybe_sales, 0) AS SIGNED) AS sale_demand,
                CAST(COALESCE(d.`add`, 0) AS SIGNED) AS replenishment
            FROM daily_sales d
            INNER JOIN sale_total_calc f
                ON d.asin = f.asin
               AND d.country = f.country
               AND d.shop = f.shop
               AND d.`date` = DATE_ADD(f.`date`, INTERVAL 1 DAY)
            WHERE d.shop = '合计'
        )
        SELECT * FROM sale_total_calc
        """,
        """
        ALTER TABLE temp_sale_inventory_simulation
        ADD INDEX idx_update (`date`, asin, country)
        """,
        """
        UPDATE daily_sales AS cur
        JOIN temp_sale_inventory_simulation AS x
            ON x.`date` = cur.`date`
           AND x.asin = cur.asin
           AND x.country = cur.country
        SET
            cur.sale_inventory = x.sale_calc_inv,
            cur.estimate_days_for_sales = CASE
                WHEN x.sale_calc_inv <= 0 THEN 0
                WHEN cur.weighted_sales > 0 THEN FLOOR(x.sale_calc_inv / cur.weighted_sales)
                ELSE 0
            END
        WHERE cur.shop = '合计'
          AND cur.`date` >= CURDATE()
        """,
        """
        DROP TEMPORARY TABLE IF EXISTS temp_sale_inventory_simulation
        """
    ]
    return execute_sql_list(cursor, "步骤5 修正合计行库存", sql_list)


# ================= 步骤6：计算历史加权基准销量 =================

def step_6_update_history_weighted_sales(cursor):
    sql_list = [
        """
        SET @start_date = DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        """,
        """
        SET @end_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        """,
        """
        UPDATE daily_sales AS target_table
        INNER JOIN (
            SELECT
                asin,
                country,
                shop,
                target_date,
                ROUND(
                    CASE
                        WHEN total_count BETWEEN 1 AND 3 THEN avg_sales
                        WHEN total_count BETWEEN 4 AND 7 THEN avg_sales_p1 * 0.7 + avg_sales_p2 * 0.3
                        WHEN total_count BETWEEN 8 AND 15 THEN avg_sales_p1 * 0.6 + avg_sales_p2 * 0.3 + avg_sales_p3 * 0.1
                        ELSE avg_sales_p1 * 0.5 + avg_sales_p2 * 0.3 + avg_sales_p3 * 0.2
                    END,
                    1
                ) AS new_weighted_sales
            FROM (
                SELECT
                    asin,
                    country,
                    shop,
                    target_date,
                    COUNT(*) AS total_count,
                    AVG(base_sales) AS avg_sales,
                    AVG(CASE
                        WHEN (total_count BETWEEN 4 AND 7 AND rn <= CEIL(total_count * 0.3))
                          OR (total_count BETWEEN 8 AND 15 AND rn <= CEIL(total_count * 0.33))
                          OR (total_count >= 16 AND rn <= 7)
                        THEN base_sales
                    END) AS avg_sales_p1,
                    AVG(CASE
                        WHEN (total_count BETWEEN 4 AND 7 AND rn > CEIL(total_count * 0.3))
                          OR (total_count BETWEEN 8 AND 15 AND rn > CEIL(total_count * 0.33) AND rn <= CEIL(total_count * 0.66))
                          OR (total_count >= 16 AND rn BETWEEN 8 AND 15)
                        THEN base_sales
                    END) AS avg_sales_p2,
                    AVG(CASE
                        WHEN (total_count BETWEEN 8 AND 15 AND rn > CEIL(total_count * 0.66))
                          OR (total_count >= 16 AND rn > 15)
                        THEN base_sales
                    END) AS avg_sales_p3
                FROM (
                    SELECT
                        t.asin,
                        t.country,
                        t.shop,
                        t.date AS target_date,
                        h.sales / NULLIF(h.coefficient, 0) AS base_sales,
                        ROW_NUMBER() OVER (
                            PARTITION BY t.asin, t.country, t.shop, t.date
                            ORDER BY h.date DESC
                        ) AS rn,
                        COUNT(*) OVER (
                            PARTITION BY t.asin, t.country, t.shop, t.date
                        ) AS total_count
                    FROM daily_sales t
                    INNER JOIN daily_sales h
                        ON t.asin = h.asin
                       AND t.country = h.country
                       AND t.shop = h.shop
                       AND h.date BETWEEN DATE_SUB(t.date, INTERVAL 30 DAY)
                                      AND DATE_SUB(t.date, INTERVAL 1 DAY)
                    WHERE t.date > @start_date
                      AND t.date <= @end_date
                ) ranked_data
                GROUP BY asin, country, shop, target_date, total_count
            ) final_calc
        ) AS source_data
            ON target_table.asin = source_data.asin
           AND target_table.country = source_data.country
           AND target_table.shop = source_data.shop
           AND target_table.date = source_data.target_date
        SET target_table.weighted_sales = source_data.new_weighted_sales
        """
    ]
    return execute_sql_list(cursor, "步骤6 计算历史加权基准销量", sql_list)


# ================= 步骤7：更新预估销量 =================

def step_7_update_maybe_sales(cursor):
    sql = """
        UPDATE daily_sales
        SET maybe_sales = weighted_sales * coefficient
    """
    return execute_sql(cursor, "步骤7 更新预估销量", sql)


# ================= 主流程 =================

def main():
    """更新水位表：分店铺推演、合计行生成、合计行BD预测、合计库存推演"""
    result = {}

    with get_db_conn() as (conn, cursor):

        # 步骤1：更新分店铺基准销量
        # 说明：同国家、ASIN、日期下，按分店铺合并销量 / 最大系数计算 base_sales。
        result["更新分店铺基准销量"] = step_1_update_base_sales(cursor)

        # 步骤2：更新分店铺未来加权基准销量
        # 说明：用最近历史基准销量计算 weighted_sales，写入今天及以后分店铺数据。
        result["更新分店铺加权基准销量"] = step_2_update_shop_weighted_sales(cursor)

        # 步骤3：分店铺库存推演
        # 说明：基于今天库存、预估销量和补货，递推分店铺未来库存、可售天数和在途。
        result["分店铺库存推演"] = step_3_update_shop_inventory(cursor)

        # 步骤4：生成或更新合计行
        # 说明：把同一国家、ASIN、日期下的分店铺数据汇总成 shop='合计' 行，并按最大系数确定合计行日类型。
        result["生成或更新合计行"] = step_4_upsert_summary_rows(cursor)

        # 步骤4-1：合计行BD预测
        # 说明：只根据 shop='合计' 的真实BD时间线推演 BD（预测），不再按店铺生成预测。
        result["合计行BD预测"] = step_4_1_update_summary_bd_prediction(cursor)

        # 步骤5：修正合计行库存结余
        # 说明：合计行BD预测已经更新 type、coefficient、maybe_sales 后，再递推合计行未来库存。
        result["修正合计行库存"] = step_5_fix_summary_inventory(cursor)

        # 步骤6：计算历史加权基准销量
        # 说明：以每条数据 date 为当天，计算过去30天到昨天的加权基准销量。
        result["计算历史加权基准销量"] = step_6_update_history_weighted_sales(cursor)

        # 步骤7：更新预估销量
        # 说明：最终按 weighted_sales * coefficient 统一刷新 maybe_sales。
        result["更新预估销量"] = step_7_update_maybe_sales(cursor)

    print("更新水位表SQL流程执行完成")
    print(result)
    return result
