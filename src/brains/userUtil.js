import userDao from '../daos/userDao';

export async function createUser({
  name, age,
}) {
  const insertId = await userDao.insertObj({
    columnNameValues: {
      name,
      age,
    },
  });
  return insertId;
}

export async function getUserById(id) {
  const user = await userDao.selectByColumns({
    byColNameValues: {
      id,
    },
    firstResultOnly: true,
  });
  return user;
}

export async function updateUser({
  id, name, age,
}) {
  const updateId = await userDao.updateByColumns(undefined, { name, age }, { id });
  return updateId;
}

