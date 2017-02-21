import BaseNativeNotifier from 'browser/components/native-notifier/base';
import ChildProcess from 'child-process';
import manifest from '../../../../package.json';

class Notification {
  constructor (appTitle, title, body, icon) {
    this.app = appTitle;
    this.title = title;
    this.body = body;
    this.icon = icon;
    this.onCreate = null;
    this.onReply = null;
    this.reply = {
      isReply: false,
      payload: {
        message: '',
        expedient: ''
      },
      replied: [false, '']
    };
  }

  setReply (expedient, message) {
    this.reply.isReply = true;
    this.reply.payload = {
      message: message,
      expedient: expedient
    };
  }

  on (event, callback) {
    switch (event) {
      case 'create':
        this.onCreate = callback;
        break;
      case 'reply':
        this.onReply = callback;
        break;
      default:
        break;
    }
  }

  notificationCallback (err, stdout, stderr) {
    if (err) {
      console.log(err);
      return;
    }
    var out = stdout.split(':');
    // if (out[0] === 'reply') {
    //   this.reply.replied = [true, out[1].trim()];
    //   if (this.onReply) {
    //     this.onReply(this.reply.replied);
    //   }
    // }
    if (out[0] === 'ans') {
      var args = [
        '--entry',
        '--title', 'Reply to ' + this.reply.payload.expedient,
        '--text', this.reply.payload.message
      ];
      ChildProcess.exec('zenity', args, {}, (err, stdout, stderr) => {
        if (err) {
          console.log('Error while replying from notification\n${err}\nstdout: ${stdout}');
          ChildProcess.execFile('zenity', ['--error', '--message=Could not send reply.']);
          return;
        }
        if (this.onReply) {
          this.onReply(stdout);
        }
      });
    }
  }

  show () {
    var args = [
      '--app-title', this.app,
      '--title', this.title,
      '--body', this.body,
      '--icon', this.icon
    ];
    // if (this.reply.isReply) {
    //   args.push([
    //     '--reply',
    //     '--reply-to', this.reply.payload.expedient,
    //     '--reply-message', this.reply.payload.message
    //   ]);
    // }

    // Workaround
    if (this.reply.isReply) {
      args.push([
        '--action', 'ans,Answer'
      ]);
    }

    ChildProcess.exec('libnotify-terminal', args, {}, this.notificationCallback);
    if (this.onCreate) {
      this.onCreate();
    }
  }
}

class LinuxNativeNotifier extends BaseNativeNotifier {
  constructor () {
    super();

    // Signals that the notifier is implemented.
    this.isImplemented = true;
    // Toggles whether the reply is shown only when the reply window (concealed), or both in the notification and in the reply window.
    this.replyConceal = false;
    // Gets the application name (shows on lock screen)
    this.app_title = manifest.productName;
    // Toggles repliability of notifications
    this.canReply = true;
    // Creates an array with notifications
    this.notifications = {};
  }

  // Fires the notification. Note: onClick is treated as a reply callback.
  fireNotification ({
    title,
    body,
    footer,
    timeout,
    tag = title,
    icon,
    onClick,
    onCreate
  }) {
    const identifier = tag + ':::' + Date.now();

    var n = new Notification(manifest.productName, title, body, icon);
    if (this.canReply) {
      n.setReply(title.split(':')[0].trim(), body);
    }
    n.on('reply', (message) => {
      var payload = {
        response: message
      };
      onClick(payload);
    });

    n.on('create', () => {
      const data = {title, body, footer, timeout, tag, onClick, onCreate, identifier};
      if (onCreate) {
        onCreate(data);
      }
    });

    n.show();

    this.notifications[identifier] = n;
  }
}

export default LinuxNativeNotifier;
