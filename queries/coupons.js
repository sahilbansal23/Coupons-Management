const createCoupon = `
    INSERT INTO public.coupons(
	id, type, details, threshold_qty, created_at, updated_at, expiry_at, is_active)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;
  `;

const getAllCoupons = `
    SELECT
      id,
      type,
      details,
      threshold_qty,
      is_active,
      expiry_at,
      created_at,
      updated_at
    FROM coupons
    WHERE is_active = true
    ORDER BY created_at DESC;
  `;

const getCouponById = `
    SELECT
      id,
      type,
      details,
      is_active,
      threshold_qty,
      expiry_at,
      created_at,
      updated_at
    FROM coupons
    WHERE id = $1;
  `;

const updateCoupon = `
    UPDATE coupons
    SET
      details = $2,
      expiry_at = $3,
      updated_at = $4
    WHERE id = $1
    RETURNING *;
  `;

const deactivateCoupon = `
    UPDATE coupons
    SET
      is_active = false,
      updated_at = $2
    WHERE id = $1;
  `;

const getActiveNonExpiredCoupons = `
    SELECT *
    FROM coupons
    WHERE is_active = true
      AND (expiry_at IS NULL OR expiry_at > NOW());
  `;
const getCouponsByType = `
    SELECT id,
      type,
      details,
      is_active,
      threshold_qty,
      expiry_at,
      created_at,
      updated_at
    FROM coupons
    WHERE type = $1
      AND is_active = true;
  `;
const getAllCouponsNotExpire = ` SELECT
  id,
  type,
  details,
  threshold_qty,
  is_active,
  expiry_at,
  created_at,
  updated_at
FROM coupons
WHERE
  is_active = true
  AND (expiry_at IS NULL OR expiry_at >= $1)
ORDER BY created_at DESC;

    `;
module.exports = {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deactivateCoupon,
  getActiveNonExpiredCoupons,
  getCouponsByType,
  getAllCouponsNotExpire,
};
