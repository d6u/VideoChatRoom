export async function handler(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      type: "Welcome",
      message: "Welcome to The Gameroom.",
    }),
  };
}
