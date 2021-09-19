import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

/**
 * The complete Triforce, or one or more components of the Triforce.
 * @typedef {Object} FlexChannelArgs
 * @property {string} identity
 * @property {string} chatUniqueName
 * @property {string} chatUserFriendlyName
 * @property {string} chatFriendlyName
 * @property {string} target
 * @property {Record<string, any>} preEngagementData
 */

export class Twilio {
  /**
   *
   * @param {string} accountSid
   * @param {string} authToken
   */
  constructor(accountSid, authToken) {
    this.accountSid = accountSid;
    this.authToken = authToken;
  }

  get getInstance() {
    return twilio(this.accountSid, this.authToken);
  }

  async listTasks() {
    return this.getInstance.taskrouter
      .workspaces(process.env.FLEX_WORKSPACE_SID)
      .tasks.list({ limit: 500 });
  }

  async listChannels() {
    return await this.getInstance.chat
      .services(process.env.FLEX_CHANNEL_SERVICE_SID)
      .channels.list({ limit: 500 });
  }

  /**
   *
   * @param {string} channelSid
   */
  async getChannel(channelSid) {
    return this.getInstance.chat
      .services(process.env.FLEX_CHANNEL_SERVICE_SID)
      .channels(channelSid)
      .fetch();
  }

  /**
   *
   * @param {FlexChannelArgs} channelArgs
   */
  async createFlexTask({
    identity,
    chatUniqueName,
    chatUserFriendlyName,
    chatFriendlyName,
    target,
    preEngagementData,
  }) {
    try {
      const createdChannel = await this.getInstance.flexApi.channel.create({
        flexFlowSid: process.env.FLEX_FLOW_SID,
        identity,
        chatUniqueName,
        chatUserFriendlyName,
        chatFriendlyName,
        target,
        preEngagementData: JSON.stringify(preEngagementData || {}),
      });

      /**
       * We created the channel above, we need to fetch a reloaded channel here
       */
      const channel = await this.getChannel(createdChannel.sid);

      let isTaskPending = false;

      const attributes = JSON.parse(channel.attributes) || {};

      if (attributes.taskSid) {
        isTaskPending = await this.isTaskPending(attributes.taskSid);
      }

      if (isTaskPending) {
        console.log('task is already created, and is pending...');
        return;
      } else {
        const task = await this.createTask({
          preEngagementData,
          channelSid: channel.sid,
        });

        attributes.taskSid = task.sid;
        await channel.update({ attributes: JSON.stringify(attributes) });
        return;
      }
    } catch (error) {
      console.error('creating flex task failed ', error);
    }
  }

  async createTask({ preEngagementData, channelSid }) {
    return this.getInstance.taskrouter
      .workspaces(process.env.FLEX_WORKSPACE_SID)
      .tasks.create({
        taskChannel: 'on-exchange-applications',
        workflowSid: process.env.FLEX_WORKFLOW_SID,
        attributes: JSON.stringify({ ...preEngagementData, channelSid }),
      });
  }

  /**
   *
   * @param {string} taskId
   * @returns {boolean}
   */
  async isTaskPending(taskId) {
    try {
      const task = await this.getInstance.taskrouter
        .workspaces(process.env.FLEX_WORKSPACE_SID)
        .tasks(taskId)
        .fetch();

      return !['completed', 'canceled', 'wrapping'].includes(
        task.assignmentStatus
      );
    } catch (error) {
      console.error('error checking pending task... ', error);
      if (error.status === 404) {
        return false;
      }
    }
  }

  async clean() {
    try {
      console.log('Cleaning up taskrouter tasks...');

      const tasks = await this.listTasks();

      await Promise.all(
        tasks.map(async task => {
          await task.remove();
          console.log('removed task ', task.sid);
        })
      );

      console.log('cleaning up chat channels...');

      const channels = await this.listChannels();

      await Promise.all(
        channels.map(async channel => {
          await channel.remove();
          console.log('removed channel ', channel.sid);
        })
      );
    } catch (error) {
      console.error('cleanup errors: ', error);
    }
  }
}
