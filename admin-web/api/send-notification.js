// Push notifications are ran on Vercel servers from this which prevents the CORS error
// api/send-notification.js
export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Grab the data sent from your React frontend
  const { expoPushToken, messageBody, ticketTitle, ticketId } = req.body;

  if (!expoPushToken) {
    return res.status(400).json({ error: 'Missing Expo Push Token' });
  }

  // 3. Build the exact message Expo expects
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: ticketTitle || 'GrievEase Update',
    body: messageBody,
    data: { ticketId: ticketId },
  };

  try {
    // 4. Send it to Expo (No CORS here, we are on a server!)
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const data = await expoResponse.json();
    
    // 5. Tell the React frontend it was a success
    return res.status(200).json({ success: true, expoData: data });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}