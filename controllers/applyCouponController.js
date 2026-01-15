const { pool } = require("../config/dbconfig");
const couponQueries = require("../queries/coupons");
const logger = require("../utils/logger");

const calculateCartTotal = (items) => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

const getItemByProductId = (items, productId) => {
  return items.find((item) => item.product_id === productId);
};

const findApplicableCoupons = async (coupons, cart) => {
  const applicableCoupons = [];
  const cartTotal = calculateCartTotal(cart.items);

  console.log(cartTotal);

  for (const coupon of coupons) {
    let discount = 0;

    switch (coupon.type) {
      case "cart-wise":
        discount = await handleCartWise(coupon, cartTotal);
        break;

      case "product-wise":
        discount = await handleProductWise(coupon, cart.items);
        break;

      case "bxgy":
        console.log("git bxgy");

        discount = await handleBxGy(coupon, cart.items);
        break;

      default:
        continue;
    }

    if (discount > 0) {
      applicableCoupons.push({
        coupon_id: coupon.id,
        type: coupon.type,
        discount,
      });
    }
  }

  return applicableCoupons;
};

const handleCartWise = async (coupon, cartTotal) => {
  const { threshold, discount } = coupon.details;

  if (cartTotal >= threshold) {
    return (cartTotal * discount) / 100;
  }

  return 0;
};

const handleProductWise = async (coupon, items) => {
  const { product_id, discount } = coupon.details;

  const item = getItemByProductId(items, product_id);
  if (!item) return 0;

  const productTotal = item.price * item.quantity;
  return (productTotal * discount) / 100;
};

function handleBxGy(coupon, cartItems) {
  let cartMap = {};
  let discount = 0;
  let freeItems = [];
  const coupon_details = coupon.details;
  // Step 1: Build cart map
  for (const item of cartItems) {
    cartMap[item.product_id] = {
      quantity: item.quantity,
      price: item.price,
    };
  }

  // Step 2: Sum total eligible BUY quantity
  let totalEligibleQty = 0;

  for (const buy of coupon_details.buy_products) {
    if (cartMap[buy.product_id]) {
      totalEligibleQty += cartMap[buy.product_id].quantity;
    }
  }

  // If no eligible quantity, coupon not applicable
  if (totalEligibleQty === 0) {
    return { discount: 0, freeItems: [] };
  }

  // Step 3: Determine group quantity (Bx)
  const groupQty = coupon_details.buy_products[0].quantity;

  let applications = Math.floor(totalEligibleQty / groupQty);

  // Step 4: Apply repetition limit
  if (coupon_details.repition_limit) {
    applications = Math.min(applications, coupon_details.repition_limit);
  }

  if (applications <= 0) {
    return { discount: 0, freeItems: [] };
  }

  // Step 5: Calculate FREE products
  for (const get of coupon_details.get_products) {
    const freeQty = get.quantity * applications;

    if (cartMap[get.product_id]) {
      const price = cartMap[get.product_id].price;
      discount += freeQty * price;
    }

    freeItems.push({
      product_id: get.product_id,
      quantity: freeQty,
    });
  }

  return discount;
}

const getApplicableCoupons = async (req, res) => {
  const client = await pool.connect();
  try {
    const currentDateStamp = Date.now();
    const coupons = await client.query(couponQueries.getAllCouponsNotExpire, [
      currentDateStamp,
    ]);
    const cart_items = req.body.cart;
    console.log(coupons.rows);

    if (cart_items.length == 0) {
      res.status(400).send({
        message: "no item in cart",
      });
    }
    const applicableCoupons = await findApplicableCoupons(
      coupons.rows,
      cart_items
    );

    return res.json({ applicable_coupons: applicableCoupons });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({ error: "Failed to evaluate coupons" });
  } finally {
    client.release();
  }
};
module.exports = {
  getApplicableCoupons,
};
