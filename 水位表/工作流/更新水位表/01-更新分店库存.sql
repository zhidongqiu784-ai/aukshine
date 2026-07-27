-- 工作流：更新水位表
-- 节点序号：1
-- 节点名称：更新水位表分店铺的库存为0点基准库存的可售+待调仓

UPDATE daily_sales AS ds
LEFT JOIN inventory_base AS cs
    ON cs.asin = ds.asin 
    AND cs.country = ds.country 
    AND cs.shop = ds.shop 
    AND cs.date = ds.date
LEFT JOIN woot_statistics AS ws
    ON ds.asin = ws.asin
    AND ds.country = ws.country 
    AND ds.date = ws.date
SET 
    ds.inventory = CASE
        WHEN ds.shop = 'woot' THEN COALESCE(ws.remaining_stock, 0)
        ELSE COALESCE(cs.afn_fulfillable_quantity, 0) + COALESCE(cs.reserved_fc_transfers, 0)
    END,
    ds.sale_inventory = CASE
        WHEN ds.shop = 'woot' THEN COALESCE(ws.remaining_stock, 0)
        ELSE COALESCE(cs.afn_fulfillable_quantity, 0) + COALESCE(cs.reserved_fc_transfers, 0)
    END
WHERE ds.date = CURDATE() 
  AND ds.shop <> '合计';
