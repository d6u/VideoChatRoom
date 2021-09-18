const SERVERS = {
  iceServers: [
    {
      // urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
      urls: ['stun:13.57.211.159:3478', 'turn:13.57.211.159:3478'],
      username: "username2",
      credential: "password2",
    }
  ],
  iceCandidatePoolSize: 10,
};

export {
  SERVERS,
};
