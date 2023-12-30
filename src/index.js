/* eslint-disable no-console */
import './env';
import express from 'express';
import bodyParser from 'body-parser';
import L from './utils/logger';
import {
  HTTP_CODE, BIZ_ERROR, APP_ISE, DB_DUPLICATE_ERROR, ERR_MSG_CODE,
} from './utils/constants';
import { getLongUrl, shortenUrl } from './brains/urlUtil';

export function catcher(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

const app = express();

const port = 3000;

app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));

app.post('/shorten_url', catcher(async (req, res) => {
  const { url: longUrl } = req.body;
  res.send({
    short_url: await shortenUrl(longUrl),
  });
}));

app.get('/:shortUrl', catcher(async (req, res) => {
  const { shortUrl } = req.params;
  const longUrl = await getLongUrl(shortUrl);
  res.redirect(longUrl);
}));

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});


export function isDuplicateErr(err) {
  return err && err.message && err.message.includes(DB_DUPLICATE_ERROR);
}

const apiErrorHandler = (err, req, res, next) => {
  if (err.name === BIZ_ERROR || isDuplicateErr(err)) {
    if (!err.status) err.status = HTTP_CODE.BAD_REQUEST;
    if (err.message && err.message.includes(DB_DUPLICATE_ERROR)) {
      const code = ERR_MSG_CODE.DB_DUPLICATE_ENTRY;
      err.code = code;
    }

    L.warn(`{type: ${BIZ_ERROR}, name: ${BIZ_ERROR}, status: ${err.status}`);
    res
      .status(err.status)
      .send({
        message: 'Error',
        meta: err.meta,
        errcode: err.code,
      });
  } else { // req may not be available for uncaughtexceptions, also JSON.stringify(err) is {}
    L.error(`{type: ${APP_ISE}, name: ${err}, message: ${err.message}, stack: ${err.stack}`);
    if (res) {
      res
        .status(HTTP_CODE.SERVER_ERROR)
        .send({
          type: APP_ISE,
          name: err.name,
          message: err.message,
          stack: err.stack,
        });
    }
  }
};

app.use(apiErrorHandler);

process.on('uncaughtException', apiErrorHandler);

process.on('unhandledRejection', (reason, promise) => {
  if (reason instanceof Error) {
    const reasonObj = reason;
    reasonObj.message = `Unhandled Rejection at: ${reason.message}`;
    L.error(reason);
  } else {
    L.warn(`Unhandled Rejection at: ${promise}, reason: ${JSON.stringify(reason)}`)
  }
});

process.on('warning', (warning) => {
  console.log(warning.name);
  console.log(warning.message);
});

export default app;
