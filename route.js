const express = require("express");
const router = express.Router();

const couponController = require("./controllers/couponController");
const applyCouponController = require("./controllers/applyCouponController");

router.post("/coupons", couponController.createCoupon);
router.get("/coupons", couponController.getAllCoupons);
router.get("/coupons/:id", couponController.getCouponById);
router.put("/coupons/:id", couponController.updateCoupon);
router.delete("/coupons/:id", couponController.deleteCoupon);

router.post("/applicable-coupons", applyCouponController.getApplicableCoupons);
router.post("/apply-coupon/:id", applyCouponController.applyCoupon);

module.exports = router;
