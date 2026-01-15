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
    return { discount: 0, freeItems: [] };
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

  for (const item of getCandidates) {
    logger.info(item);
  }
  if (getCandidates.length === 0) {
    return { discount: 0, freeItems: [] };
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
  console.log(`freeItems: ${freeItems.rows}`);
  console.log(`discount: ${discount}`);

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
    console.log(coupons.rows);

    if (cart_items.length == 0) {
      res.status(400).send({
        message: "no item in cart",
      });
    }
    for (item of cart_items.items) {
      if (item.price == 0) {
        return res.status(400).send({ msg: "item can not have price = 0" });
      }
      if (item.quantity == 0) {
        return res.status(400).send({ msg: "item can not have quantity = 0" });
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
module.exports = {
  getApplicableCoupons,
};
