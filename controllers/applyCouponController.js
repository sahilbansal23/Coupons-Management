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

async function handleBxGy(coupon, cartItems) {
  let cartMap = {};
  let discount = 0;
  const couponDetails = coupon.details;
  // Step 1: Build cart map
  for (const item of cartItems) {
    cartMap[item.product_id] = {
      quantity: item.quantity,
      price: item.price,
    };
  }

  // Step 2: Calculate total BUY quantity (COMBINATION)
  let totalBuyQty = 0;

  for (const buy of couponDetails.buy_products) {
    if (cartMap[buy.product_id]) {
      totalBuyQty += cartMap[buy.product_id].quantity;
    }
  }

  if (totalBuyQty === 0) {
    return { discount: 0, freeItems: [] };
  }
  console.log(`totalBuyQty: ${totalBuyQty}`);

  // Step 3: Calculate applications
  const groupQty = couponDetails.buy_products[0].quantity; // e.g. Buy 3
  let applications = Math.floor(totalBuyQty / groupQty);

  if (couponDetails.repition_limit) {
    applications = Math.min(applications, couponDetails.repition_limit);
  }

  if (applications <= 0) {
    return 0;
  }

  // Step 4: Max free quantity allowed
  const maxFreeQty =
    applications *
    couponDetails.get_products.reduce((sum, g) => sum + g.quantity, 0);
  console.log(`maxFreeQty: ${maxFreeQty}`);

  // Step 5: Collect GET products from cart
  let getCandidates = [];

  for (const get of couponDetails.get_products) {
    const cartItem = cartMap[get.product_id];
    if (cartItem && cartItem.quantity > 0) {
      getCandidates.push({
        product_id: get.product_id,
        quantity: cartItem.quantity,
        price: cartItem.price,
      });
    }
  }

  // Step 6: Sort GET items by price (DESC)
  getCandidates.sort((a, b) => b.price - a.price);
  if (getCandidates.length === 0) {
    return 0;
  }

  let remainingFreeQty = maxFreeQty;
  let freeItems = [];

  for (const item of getCandidates) {
    if (remainingFreeQty <= 0) break;

    const freeQty = Math.min(item.quantity, remainingFreeQty);

    discount += freeQty * item.price;
    remainingFreeQty -= freeQty;

    freeItems.push({
      product_id: item.product_id,
      quantity: freeQty,
    });
  }
  // return total numeric discount for applicability check

  //   return {
  //     discount,
  //     freeItems,
  //     applications,
  //     maxFreeQty
  //   };
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

    // basic cart validation
    if (
      !cart_items ||
      !Array.isArray(cart_items.items) ||
      cart_items.items.length === 0
    ) {
      return res
        .status(400)
        .send({
          message: "cart is required and must contain at least one item",
        });
    }

    for (const item of cart_items.items) {
      if (typeof item.price !== "number" || item.price <= 0) {
        return res
          .status(400)
          .send({ msg: "each item must have a positive numeric price" });
      }
      if (typeof item.quantity !== "number" || item.quantity <= 0) {
        return res
          .status(400)
          .send({ msg: "each item must have a positive numeric quantity" });
      }
    }
    const applicableCoupons = await findApplicableCoupons(
      coupons.rows,
      cart_items
    );

    return res.status(200).send({ applicable_coupons: applicableCoupons });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({ error: "Failed to evaluate coupons" });
  } finally {
    client.release();
  }
};

const cloneItems = (items) =>
  items.map((item) => ({
    ...item,
    total_discount: 0,
  }));

const findItem = (items, productId) =>
  items.find((i) => i.product_id === productId);

const applyCouponToCart = async (coupon, cart) => {
  try {
    const items = cloneItems(cart.items);
    const cartTotal = calculateCartTotal(items);

    let totalDiscount = 0;

    switch (coupon.type) {
      case "cart-wise":
        totalDiscount = await applyCartWise(coupon, items, cartTotal);
        break;

      case "product-wise":
        totalDiscount = await applyProductWise(coupon, items);
        break;

      case "bxgy":
        totalDiscount = await applyBxGy(coupon, items);
        break;

      default:
        throw new Error("Unsupported coupon type");
    }

    const finalPrice = cartTotal - totalDiscount;

    return {
      updated_cart: {
        items,
        total_price: cartTotal,
        total_discount: totalDiscount,
        final_price: finalPrice,
      },
    };
  } catch (error) {
    logger.error(error);
    throw new Error(error);
  }
};

const applyCartWise = async (coupon, items, cartTotal) => {
  try {
    const { threshold, discount } = coupon.details;

    if (cartTotal < threshold) {
      throw new Error("Coupon not applicable for this cart");
    }

    const totalDiscount = (cartTotal * discount) / 100;

    // Distribute discount proportionally
    for (const item of items) {
      const itemTotal = item.price * item.quantity;
      const itemDiscount = (itemTotal / cartTotal) * totalDiscount;

      item.total_discount = Number(itemDiscount.toFixed(2));
    }

    return Number(totalDiscount.toFixed(2));
  } catch (error) {
    logger.error(error);
    throw new Error(error);
  }
};

const applyProductWise = (coupon, items) => {
  const { product_id, discount } = coupon.details;

  const item = findItem(items, product_id);
  if (!item) {
    throw new Error("Coupon not applicable for this cart");
  }

  const productTotal = item.price * item.quantity;
  const totalDiscount = (productTotal * discount) / 100;

  item.total_discount = Number(totalDiscount.toFixed(2));

  return Number(totalDiscount.toFixed(2));
};

const applyBxGy = (coupon, items) => {
  const { buy_products, get_products, repition_limit } = coupon.details;

  let cartMap = {};
  for (const item of items) {
    cartMap[item.product_id] = item;
  }

  // Step 1: count total buy qty
  let totalBuyQty = 0;
  for (const buy of buy_products) {
    if (cartMap[buy.product_id]) {
      totalBuyQty += cartMap[buy.product_id].quantity;
    }
  }

  if (totalBuyQty === 0) {
    throw new Error("Coupon not applicable for this cart");
  }

  const groupQty = buy_products[0].quantity;
  let applications = Math.floor(totalBuyQty / groupQty);

  if (repition_limit) {
    applications = Math.min(applications, repition_limit);
  }

  if (applications <= 0) {
    throw new Error("Coupon not applicable for this cart");
  }

  let totalDiscount = 0;

  // Step 2: apply free items (capped by availability)
  for (const get of get_products) {
    const item = cartMap[get.product_id];
    if (!item) continue;

    const expectedFreeQty = get.quantity * applications;
    const actualFreeQty = Math.min(expectedFreeQty, item.quantity);

    const discount = actualFreeQty * item.price;

    item.quantity += actualFreeQty; // extra free items
    item.total_discount += discount;
    totalDiscount += discount;
  }

  return totalDiscount;
};

const applyCoupon = async (req, res) => {
  const client = await pool.connect();
  try {
    const couponResult = await client.query(couponQueries.getCouponById, [
      req.params.id,
    ]);

    if (!couponResult.rows.length) {
      return res.status(404).send({ error: "Coupon not found" });
    }
    const coupon = couponResult.rows[0];
    const currentDateStamp = Date.now();

    // check active
    if (!coupon.is_active) {
      return res.status(400).send({ error: "Coupon is not active" });
    }

    // check expiry (expiry_at stored as epoch ms)
    if (coupon.expiry_at != null && coupon.expiry_at < currentDateStamp) {
      return res.status(400).send({ error: "Coupon has expired" });
    }

    const cart = req.body.cart;

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res
        .status(400)
        .send({ error: "cart is required and must contain at least one item" });
    }

    const result = await applyCouponToCart(coupon, cart);

    return res.status(200).send(result);
  } catch (error) {
    logger.error(error.message);
    return res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  getApplicableCoupons,
  applyCoupon,
};
