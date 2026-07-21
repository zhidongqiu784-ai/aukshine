UPDATE sales_coefficient AS sc
INNER JOIN (
    SELECT
        dtt.country AS activity_region,
        dtt.daytype,
        MAX(dtt.chushixishu) AS initial_coefficient
    FROM datetypetime AS dtt
    WHERE dtt.daytype_category <> '基础活动类型'
      AND dtt.daytype IS NOT NULL
      AND TRIM(dtt.daytype) != ''
      AND dtt.chushixishu IS NOT NULL
    GROUP BY
        dtt.country,
        dtt.daytype
    HAVING COUNT(DISTINCT dtt.chushixishu) = 1
) AS cfg
    ON cfg.daytype = sc.type
   AND FIND_IN_SET(sc.country, cfg.activity_region) > 0
SET
    sc.coefficient = cfg.initial_coefficient
WHERE NOT (
    sc.coefficient <=> cfg.initial_coefficient
);
