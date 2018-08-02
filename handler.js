'use strict';

const uuid = require('uuid');
const AWS = require('aws-sdk');
const Validator = require('validatorjs');
const libphonenumber = require('libphonenumber-js');

Validator.register(
  'phone',
  value => {
    return libphonenumber.isValidNumber(value);
  },
  'The phone number has incorrect format'
);

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const formatUser = user => ({
  id: user.id,
  name: user.name,
  surname: user.surname.charAt(0),
  phone: user.phone.substr(user.phone.length - 4),
  createdAt: user.createdAt
});

module.exports.createUser = (event, context, callback) => {
  const timestamp = new Date().getTime();
  const data = JSON.parse(event.body);

  const validation = new Validator(data, {
    name: 'required|string',
    surname: 'required|string',
    phone: 'required|phone'
  });

  if (validation.fails()) {
    callback(null, {
      statusCode: 422,
      body: JSON.stringify(validation.errors.all())
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
        body: JSON.stringify({message: "Couldn't create user."})
      });
      return;
    }

    const response = {
      statusCode: 200,
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
        body: JSON.stringify({message: "Couldn't fetch user."})
      });
      return;
    }

    // create a response
    const response = {
      statusCode: 200,
      body: JSON.stringify(result.Items.map(formatUser))
    };
    callback(null, response);
  });
};
