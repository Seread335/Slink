ALTER TABLE stores
  ADD COLUMN phone text NOT NULL DEFAULT '' CHECK (length(phone) <= 40),
  ADD COLUMN address text NOT NULL DEFAULT '' CHECK (length(address) <= 300),
  ADD COLUMN receipt_footer text NOT NULL DEFAULT '' CHECK (length(receipt_footer) <= 240),
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
