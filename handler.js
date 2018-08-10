'use strict';

const uuid = require('uuid');
const AWS = require('aws-sdk');
const Validator = require('validatorjs');
const libphonenumber = require('libphonenumber-js');

Validator.register(
  'phone',
  value => libphonenumber.isValidNumber(value),
  'format incorrecte'
);

const messages = Validator.getMessages('en');
messages.required = 'és obligatori';
Validator.setMessages('en', messages);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
};

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const formatUser = user => ({
  id: user.id,
  name: user.name,
  surname: user.surname.charAt(0),
  phone: user.phone.substr(user.phone.length - 4),
  assignedTask: user.assignedTask,
  createdAt: user.createdAt
});

module.exports.createUser = (event, context, callback) => {
  const timestamp = new Date().getTime();
  const data = JSON.parse(event.body);

  const validation = new Validator(data, {
    name: 'required',
    surname: 'required',
    phone: 'required|phone'
  });

  if (validation.fails()) {
    let errors = validation.errors.all();
    Object.keys(errors).forEach(attr => {
      errors[attr] = validation.errors.first(attr);
    });
    callback(null, {
      statusCode: 422,
      headers,
      body: JSON.stringify({errors})
    });
    return;
  }

  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Item: {
      id: uuid.v1(),
      name: data.name,
      surname: data.surname,
      phone: data.phone,
      assignedTask: 'TBC',
      createdAt: timestamp
    }
  };

  dynamoDb.put(params, error => {
    if (error) {
      console.error(error);
      callback(null, {
        statusCode: error.statusCode || 501,
        headers,
        body: JSON.stringify({error: 'Couldn\'t create user.'})
      });
      return;
    }

    const response = {
      statusCode: 200,
      headers,
      body: JSON.stringify(formatUser(params.Item))
    };
    callback(null, response);
  });
};

module.exports.listUsers = (event, context, callback) => {
  const params = {
    TableName: process.env.DYNAMODB_TABLE
  };

  dynamoDb.scan(params, (error, result) => {
    if (error) {
      console.error(error);
      callback(null, {
        statusCode: error.statusCode || 501,
        body: JSON.stringify({error: 'Couldn\'t fetch user.'})
      });
      return;
    }

    const body = result.Items.map(formatUser).sort((x, y) => y.createdAt - x.createdAt);

    const response = {
      statusCode: 200,
      headers,
      body: JSON.stringify(body)
    };
    callback(null, response);
  });
};
