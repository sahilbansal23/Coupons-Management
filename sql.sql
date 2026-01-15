CREATE TABLE public.coupons
(
    id character varying NOT NULL,
    type character varying,
    details json,
    threshold_qty bigint,
    created_at bigint,
    updated_at bigint,
    expiry_at bigint,
    PRIMARY KEY (id)
);
