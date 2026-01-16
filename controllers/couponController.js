const { pool } = require("../config/dbconfig");
const couponQueries = require("../queries/coupons");
const logger = require("../utils/logger");
const validateCouponType = require("../utils/validateCouponType");
const { ulid } = require("ulid");

const createCoupon = async (req, res) => {
  const client = await pool.connect();
  try {
    const { type, details, expiry_at, threshold_qty } = req.body;
    const checkTypeValidilty = await validateCouponType.validateCouponType(
      type
    );
    if (checkTypeValidilty.isValid == false) {
      return res.status(400).send({ error: checkTypeValidilty.error });
    }
    await client.query("BEGIN");

    const couopon_id = ulid();
    const currentDateStamp = Date.now();
    const result = await client.query(couponQueries.createCoupon, [
      couopon_id,
      type,
      details,
      threshold_qty,
      currentDateStamp,
      currentDateStamp,
      expiry_at,
      true,
    ]);

    await client.query("COMMIT");

    res.status(201).send({ result: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(error);
    res.status(500).send({ error: "Failed to create coupon" });
  } finally {
    client.release();
  }
};

const getAllCoupons = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(couponQueries.getAllCoupons);
    res.status(200).send(result.rows);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ error: "Failed to fetch coupons" });
  } finally {
    client.release();
  }
};

const getCouponById = async (req, res) => {
  const client = await pool.connect();
  try {
    const coupon_id = req.params.id;
    const result = await client.query(couponQueries.getCouponById, [coupon_id]);

    if (!result.rows.length) {
      res.status(404).send({ error: "Coupon not found" });
    }

    res.status(200).send(result.rows[0]);
  } catch (error) {
    logger.error(error);
    res.status(500).send({ error: "Failed to fetch coupon" });
  } finally {
    client.release();
  }
};

const updateCoupon = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const coupon_id = req.params.id;
    const { details, expiry_at } = req.body;
    const currentDateStamp = Date.now();
    const result = await client.query(couponQueries.updateCoupon, [
      coupon_id,
      details,
      expiry_at,
      currentDateStamp,
    ]);

    await client.query("COMMIT");
    res.status(200).send(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(error);
    res.status(500).send({ error: "Failed to update coupon" });
  } finally {
    client.release();
  }
};

const deleteCoupon = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const coupon_id = req.params.id;

    const currentDateStamp = Date.now();

    const result = await client.query(couponQueries.deactivateCoupon, [
      coupon_id,
      currentDateStamp,
    ]);
    await client.query("COMMIT");

    if (result.rowCount != 1) {
      return res.status(400).send({ result: "some error Occured" });
    }
    logger.info(`Succesfully Deactivate the coupon '${coupon_id}'`);
    res.status(200).send({ result: "Successfully Deleted" });
    
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error(error);
    res.status(500).send({ error: "Failed to delete coupon" });
  } finally {
    client.release();
  }
};

module.exports = {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
};
