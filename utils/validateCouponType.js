const VALID_COUPON_TYPES = Object.freeze(["cart-wise", "product-wise", "bxgy"]);

const validateCouponType = async (type) => {
  try {
    if (!type || typeof type !== "string") {
      return {
        isValid: false,
        error: "Coupon type is required and must be a string",
      };
      }

    if (!VALID_COUPON_TYPES.includes(type)) {
      return {
        isValid: false,
        error: `Invalid coupon type. Allowed types: ${VALID_COUPON_TYPES.join(
          ", "
        )}`,
      };
    }

    return {
      isValid: true,
    };
  } catch (error) {
    throw new Error("Error validating coupon type");
  }
};

module.exports = { validateCouponType };
