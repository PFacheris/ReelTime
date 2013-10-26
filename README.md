# ReelTime
#### An experiment into streaming video parties.
### WARNING:
* Currently, this is very much a hack and will only work in modern browsers, however as the HTML5 video streaming API is constantly changing, things may break, leave an issue and/or submit a pull request when this happens. I will attempt to clean it up and use various new technologies as they become available. Goal is to move back to WebRTC for streaming of file data rather than websockets.
* Be sure FFMPEG is installed locally.

### DESCRIPTION:
* Users enter a room of the same name, a single user selects a video file of any format and that file is converted and pushed to all other users in the room. Video playback is synchronized between users.

### CURRENT BUGS/LIMITATIONS:
* There is an issue with Chrome's HTML5 Streaming API that prevents pushing of webm files that are not encoded in a certain way. I have not been able to replicate this encoding in FFMPEG, so this project is currently being reworked as a Google Hangouts plugin to pass the time until I figure out a good way to fix this bug.