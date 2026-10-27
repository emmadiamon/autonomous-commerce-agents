CREATE TABLE IF NOT EXISTS customers (
 id INTEGER PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY,
 customer_id INTEGER NOT NULL REFERENCES customers(id),
 status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
 total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inventory (
 sku TEXT PRIMARY KEY,
 product_name TEXT NOT NULL,
 stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0)
);
INSERT INTO customers (id,name,email) VALUES
 (1,'Avery Chen','avery@example.test'),
 (2,'Jordan Lee','jordan@example.test')
ON CONFLICT DO NOTHING;
INSERT INTO orders (id,customer_id,status,total_cents) VALUES
 (1042,1,'SHIPPED',2999),
 (1043,2,'PROCESSING',4599),
 (1044,1,'DELIVERED',1299)
ON CONFLICT DO NOTHING;
INSERT INTO inventory (sku,product_name,stock_quantity) VALUES
 ('STICKER-001','Die-cut sticker pack',120),
 ('SHIRT-002','Cotton T-shirt',8)
ON CONFLICT DO NOTHING;
