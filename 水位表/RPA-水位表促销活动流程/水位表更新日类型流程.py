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


# ================= 步骤1：恢复daily_sales默认类型 =================

def step_1_reset_daily_sales_type(cursor):
    sql = """
        UPDATE daily_sales ds
        SET ds.type = COALESCE(
            (
                SELECT GROUP_CONCAT(
                    dtt.daytype
                    ORDER BY
                        CASE dtt.daytype_category
                            WHEN '基础类型' THEN 1
                            WHEN '叠加基础类型' THEN 2
                            ELSE 9
                        END,
                        dtt.startdate,
                        dtt.id
                    SEPARATOR '、'
                )
                FROM datetypetime dtt
                WHERE dtt.daytype_category IN ('基础类型', '叠加基础类型')
                  AND FIND_IN_SET(ds.country, dtt.country) > 0
                  AND ds.date BETWEEN dtt.startdate AND dtt.enddate
            ),
            '日常'
        )
        WHERE ds.shop != '合计'
          AND ds.date BETWEEN CURDATE()
                          AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
    """
    return execute_sql(cursor, "步骤1 恢复默认类型", sql)


# ================= 步骤1.1：固定活动类型按日期覆盖 =================

def step_1_1_apply_fixed_activity_type(cursor):
    sql = """
        UPDATE daily_sales ds
        INNER JOIN datetypetime dtt
            ON ds.date BETWEEN dtt.startdate AND dtt.enddate
           AND dtt.daytype_category = '固定活动类型'
           AND FIND_IN_SET(ds.country, dtt.country) > 0
        SET ds.type = dtt.daytype
        WHERE ds.shop != '合计'
          AND ds.date BETWEEN CURDATE()
                          AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
    """
    return execute_sql(cursor, "步骤1.1 应用固定活动类型", sql)


# ================= 步骤2：真实BD/LD覆盖daily_sales =================

def step_2_update_real_bd_ld(cursor):
    sql = """
        UPDATE daily_sales ds
            INNER JOIN deal_date dd
            ON ds.country = dd.country
               AND ds.shop = dd.shop_code
               AND ds.asin = dd.asin
               AND dd.promotion_type IN ('BD', 'LD')
               AND dd.origin_status IN ('进行中', '未开始', '已结束', '未定', '未定义类型')
               AND ds.date >= DATE(dd.promotion_start_time)
               AND ds.date <= DATE(DATE_SUB(dd.promotion_end_time, INTERVAL 1 SECOND))

        SET ds.type = dd.promotion_type
        WHERE
            ds.shop != '合计'
            AND ds.date BETWEEN CURDATE()
                            AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
    """
    return execute_sql(cursor, "步骤2 更新真实BD/LD", sql)


# ================= 步骤3：大促BD/LD修正，专享覆盖 =================

def step_3_update_big_event_and_exclusive(cursor):
    sql = """
        UPDATE daily_sales ds
            INNER JOIN datetypetime dtt
            ON ds.date >= dtt.startdate
               AND ds.date <= dtt.enddate
               AND dtt.daytype_category IN ('大促BDLD', '专享类型')
               AND FIND_IN_SET(ds.country, dtt.country) > 0
               AND (
                   (
                       dtt.daytype_category = '大促BDLD'
                       AND ds.type = 'BD'
                       AND dtt.daytype LIKE 'BD%'
                   )
                   OR (
                       dtt.daytype_category = '大促BDLD'
                       AND ds.type = 'LD'
                       AND dtt.daytype LIKE 'LD%'
                   )
                   OR (
                       dtt.daytype_category = '专享类型'
                       AND ds.type NOT LIKE '%BD%'
                       AND ds.type NOT LIKE '%LD%'
                   )
               )
        SET ds.type = dtt.daytype
        WHERE
            ds.shop != '合计'
            AND ds.date BETWEEN CURDATE()
                            AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
    """
    return execute_sql(cursor, "步骤3 更新大促BD/LD与专享", sql)

# ================= 步骤4：根据类型更新系数 =================

def step_4_update_coefficient(cursor):
    result = 0

    # 4.1 普通类型：按最终日类型直接匹配系数
    sql_normal = """
        UPDATE daily_sales ds
            INNER JOIN sales_coefficient sc
            ON ds.asin = sc.asin
               AND ds.country = sc.country
               AND sc.type = ds.type
        SET
            ds.coefficient = sc.coefficient
        WHERE
            ds.shop != '合计'
            AND ds.type NOT LIKE '%、%'
            AND ds.date BETWEEN CURDATE()
                            AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
    """
    result += execute_sql(cursor, "步骤4.1 更新普通类型系数", sql_normal)

    # 4.2 复合类型：所有组成日类型的系数连乘
    sql_combo = """
        WITH RECURSIVE type_parts AS (
            SELECT
                asin,
                country,
                shop,
                date,
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
            WHERE shop != '合计'
              AND type LIKE '%、%'
              AND date BETWEEN CURDATE()
                           AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)

            UNION ALL

            SELECT
                asin,
                country,
                shop,
                date,
                type,
                SUBSTRING_INDEX(rest_type, '、', 1) AS part_type,
                CASE
                    WHEN rest_type LIKE '%、%' THEN SUBSTRING(
                        rest_type,
                        CHAR_LENGTH(SUBSTRING_INDEX(rest_type, '、', 1)) + 2
                    )
                    ELSE ''
                END AS rest_type
            FROM type_parts
            WHERE rest_type != ''
        ),
        coefficient_calc AS (
            SELECT
                tp.asin,
                tp.country,
                tp.shop,
                tp.date,
                tp.type,
                EXP(SUM(LN(sc.coefficient))) AS new_coefficient,
                COUNT(*) AS part_count,
                SUM(
                    CASE
                        WHEN sc.coefficient IS NOT NULL AND sc.coefficient > 0 THEN 1
                        ELSE 0
                    END
                ) AS matched_count
            FROM type_parts tp
            LEFT JOIN sales_coefficient sc
                ON tp.asin = sc.asin
               AND tp.country = sc.country
               AND tp.part_type = sc.type
            GROUP BY
                tp.asin,
                tp.country,
                tp.shop,
                tp.date,
                tp.type
        )
        UPDATE daily_sales ds
        INNER JOIN coefficient_calc cc
            ON ds.asin = cc.asin
           AND ds.country = cc.country
           AND ds.shop = cc.shop
           AND ds.date = cc.date
           AND ds.type = cc.type
        SET
            ds.coefficient = cc.new_coefficient
        WHERE
            cc.part_count = cc.matched_count
    """
    result += execute_sql(cursor, "步骤4.2 更新复合类型系数", sql_combo)

    return result


# ================= 主流程 =================

def main(args=None):
    """刷新店铺行日类型和系数，只更新今天到未来180天，历史数据不自动覆盖"""
    result = {}

    with get_db_conn() as (conn, cursor):

        # 步骤1：先恢复基础日类型
        # 作用：
        #   把今天到未来180天的店铺日期，先恢复成最基础的日类型。
        #   如果同一天命中多个叠加基础类型，会用“、”拼接。
        #   例如：旺季、2026世界杯。
        # 目的：
        #   先给每天打好“基础底色”，后面再根据真实活动继续叠加 BD/LD。
        # 注意：
        #   昨天及以前的历史数据不处理，避免活动取消后误改历史记录。
        result["恢复默认类型"] = step_1_reset_daily_sales_type(cursor)

        # 步骤1.1：固定活动类型按日期覆盖
        # 作用：
        #   固定活动类型单独显示，不与日常、旺季、淡季等基础类型叠加。
        #   后续真实 BD/LD 仍可继续覆盖固定活动类型。
        result["应用固定活动类型"] = step_1_1_apply_fixed_activity_type(cursor)

        # 步骤2：再更新真实 BD / LD
        # 作用：
        #   从 deal_date 表读取真实活动，只处理状态有效的 BD/LD。
        #   有效状态包括：进行中、未开始、已结束、未定、未定义类型。
        #   已取消、待申报的活动不会写入 BD/LD。
        # 结果：
        #   BD/LD 属于基础活动类型，命中后直接覆盖基础日类型。
        #   例如：旺季、2026世界杯命中真实 BD 后，最终只显示 BD。
        result["更新真实BD/LD"] = step_2_update_real_bd_ld(cursor)

        # 步骤3：修正大促 BD/LD 与专享类型
        # 作用：
        #   根据 datetypetime 表里的分类配置，进一步修正日类型。
        #   例如：把 BD 修正成 BD (7月PD)、BD (黑五网一) 等大促类型。
        #   大促 BD/LD 和专享类型均单独显示，不保留基础叠加部分。
        # 注意：
        #   专享类型不覆盖真实 BD/LD，真实活动再由大促配置修正名称。
        result["更新大促BD/LD与专享"] = step_3_update_big_event_and_exclusive(cursor)

        # 步骤4：最后更新系数
        # 作用：
        #   根据最终日类型，更新 daily_sales.coefficient。
        # 规则：
        #   普通类型直接取对应系数，例如 BD 取 BD 系数。
        #   复合类型按所有组成类型的系数连乘。
        #   固定活动类型与其他非自动计算类型一样，从 sales_coefficient 读取配置系数。
        #   例如：旺季、2026世界杯、BD = 旺季系数 × 2026世界杯系数 × BD系数。
        # 注意：
        #   系数也只更新今天到未来180天，历史系数不反向覆盖。
        result["更新系数"] = step_4_update_coefficient(cursor)

    print("店铺日类型SQL流程执行完成")
    print(result)
    return result
