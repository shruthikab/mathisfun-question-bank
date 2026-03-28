module.exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: '<h1>It works!</h1>'
  };
};
