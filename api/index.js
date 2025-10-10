// Vercel serverless function handler
export default async function handler(req, res) {
  // Import the main server logic
  const { default: server } = await import('./server/index.js');
  
  // Handle the request
  return server(req, res);
}
