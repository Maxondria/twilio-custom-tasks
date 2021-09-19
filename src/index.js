import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { Twilio } from './twilio';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.post('/submit-application', async (req, res) => {
  const {
    type = 'onExchange',
    applicant: {
      fullname,
      email,
      premium,
      planName,
      carrierName,
      effectiveDate,
    },
  } = req.body || {};

  const applicationId = uuidv4();

  const twilio = new Twilio(
    process.env.FLEX_ACCOUNT_SID,
    process.env.FLEX_AUTH_TOKEN
  );

  if (type === 'onExchange') {
    await twilio.createFlexTask({
      identity: applicationId,
      chatUniqueName: applicationId,
      chatUserFriendlyName: fullname,
      chatFriendlyName: email,
      target: applicationId,
      preEngagementData: {
        name: fullname,
        email,
        applicationId,
        carrierName,
        planName,
        premium,
        effectiveDate,
      },
    });
  }

  return res.json({
    message: `${type} application submitted. Here is the ID: ${applicationId}`,
  });
});

app.post('/on-exchange-application-flexflow', async (req, res) => {
  console.log({ body: req.body });

  return res.sendStatus(200);
});

app.listen(4555, () => {
  console.log(`Server is listening on port 4555`);
});
