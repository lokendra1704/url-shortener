/* eslint-disable consistent-return */
/* eslint-disable no-await-in-loop */
import validator from 'validator';
import { urlDao } from '../daos/urlDao';

const MAX_URL_LENGTH = 8;
let characterSet = 'abcdefghijklmnopqrstuvwxyz';
const URL_SAFE_CHARACTER_SET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~';

function generateRandomString(length = MAX_URL_LENGTH, charset = characterSet) {
  let result = '';
  const charsetLength = charset.length;
  for (let i = 0; i < length; i += 1) {
    const randomIndex = Math.floor(Math.random() * charsetLength);
    result += charset.charAt(randomIndex);
  }
  return result;
}

function expandCharacterSet() {
  if (characterSet.length === URL_SAFE_CHARACTER_SET.length) {
    return characterSet;
  }
  for (let i = 0; i < URL_SAFE_CHARACTER_SET.length; i += 1) {
    if (!characterSet.includes(URL_SAFE_CHARACTER_SET.charAt(i))) {
      characterSet += URL_SAFE_CHARACTER_SET.charAt(i);
      return characterSet;
    }
  }
}

export async function shortenUrl(longUrl) {
  const maxRetries = 10; // Number of maximum retries
  let retryCount = 0;
  let url = longUrl;
  if (!validator.isURL(longUrl, { require_protocol: true })) {
    url = `http://${url}`;
  }
  while (retryCount < maxRetries) {
    try {
      const shortIdentifier = generateRandomString();
      await urlDao.insertObj({
        columnNameValues: {
          url,
          short_url: shortIdentifier,
        },
      });
      return shortIdentifier;
    } catch (error) {
      console.error(`Attempt ${retryCount + 1} failed:`, error.message);
      retryCount += 1;
      if (retryCount === Math.floor(maxRetries / 2)) {
        console.log(expandCharacterSet());
      }
    }
  }
  return null;
}

export async function performOperationWithRetry(functionToRetry) {
  const maxRetries = 3; // Number of maximum retries
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Perform your operation here
      const result = functionToRetry();
      return result; // If successful, return the result
    } catch (error) {
      console.error(`Attempt ${retryCount + 1} failed:`, error.message);
      retryCount += 1;
    }
  }
  throw new Error('Max retries exceeded'); // Throw an error if max retries are reached
}

export async function getLongUrl(shortUrl) {
  if (!shortUrl) {
    throw new Error('Short URL cannot be null');
  }
  const result = await urlDao.selectByColumns({
    byColNameValues: {
      short_url: shortUrl,
    },
    firstResultOnly: true,
  });
  if (!result) {
    throw new Error('Invalid Short Url');
  }
  return result.url;
}
