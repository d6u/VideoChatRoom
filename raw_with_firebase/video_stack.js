export async function addVideo(videoStack, clientKey, track) {
  const video = videoStack.getVideoIfAvailable(clientKey);

  if (!video) {
    alert("Cannot add more calls.");
    return;
  }

  if (video.srcObject == null) {
    console.log("No srcObject, creating new MediaStream.");

    video.srcObject = new MediaStream();
  }

  video.srcObject.addTrack(track);
}

export class VideoStack {
  videos_ = [];
  videoPairs_ = {};

  constructor() {
    this.videos_ = Array.from(document.querySelectorAll(".remote-video"));
  }

  getVideoIfAvailable(clientKey) {
    let video = this.videoPairs_[clientKey];
    if (!video) {
      video = this.top_();
    }
    if (!video) {
      return null;
    }
    this.videoPairs_[clientKey] = video;
    return this.videoPairs_[clientKey];
  }

  recycleVideo(clientKey) {
    const video = this.videoPairs_[clientKey];
    if (!video) {
      return;
    }
    video.srcObject = null;
    this.videos_.unshift(video);
    delete this.videoPairs_[clientKey];
  }

  top_() {
    if (!this.videos_.length) {
      return null;
    }
    return this.videos_.shift();
  }
}
