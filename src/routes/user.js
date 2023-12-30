/* eslint-disable import/no-import-module-exports */
import express from 'express';
import { createUser, getUserById, updateUser } from '../brains/userUtil';
import { catcher } from '../index';

const router = express.Router();

router.get('/', catcher(async (req, res) => {
  const { id: userId } = req.query;
  res.send({
    user: await getUserById(userId),
  });
}));

router.post('/', catcher(async (req, res) => {
  const { name, age } = req.body;
  res.send({
    insertId: await createUser({
      name, age,
    }),
  });
}));

router.post('/update_user', catcher(async (req, res) => {
  const { id, name, age } = req.body;
  res.send({
    updateId: await updateUser({
      id, name, age,
    }),
  });
}));

module.exports = router;
