import BaseNativeNotifier from 'browser/components/native-notifier/base';
import ChildProcess from 'child_process';
import manifest from '../../../../package.json';

class Notification {
  constructor (appTitle, title, subtitle, body) {
    this.app = appTitle.trim();
    log('Notification.app');
    this.title = title.trim();
    log('Notification.title');
    this.subtitle = subtitle.trim();
    log('Notification.subtitle');
    this.body = body;
    log('Notification.body');
    this.icon = './resources/app/images/windowIcon.png';
    log('Notification.icon');
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
    log('Notification.setReply(' + expedient + ', ' + message, ')');
    this.reply.isReply = true;
    this.reply.payload = {
      message: message,
      expedient: expedient
    };
  }

  on (event, callback) {
    log('Notification.on(' + event + ', ' + callback, ')');
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
    log('Notification.notificationCallback(' + [err, stdout, stderr].join(', ') + ')');
    if (err) {
      logError(err);
      return;
    }
    var out = stdout.split(':');
    if (out[0] === 'reply') {
      // this.reply.replied = [true, out[1].trim()];
      if (this.onReply) {
        this.onReply(out[1].trim());
      }
    }
  }

  show () {
    var args = ['libnotify-terminal',
      '--app-title', this.app,
      '--title', this.title,
      '--subtitle', this.subtitle + ':',
      '--body', this.body,
      '--icon', this.icon
    ];
    if (this.reply.isReply) {
      args.push(
        '--reply',
        '--reply-to', this.reply.payload.expedient,
        '--reply-message', this.reply.payload.message
      );
    }

    log('Notification.show() ' + JSON.stringify(Object.assign({}, this.reply, args)));
    args.forEach((val, idx, arr) => {
      arr[idx] = '"' + val + '"';
    });
    ChildProcess.exec(args.join(' '), this.notificationCallback);
    if (this.onCreate) {
      this.onCreate();
    }
  }
}

class LinuxNativeNotifier extends BaseNativeNotifier {
  constructor () {
    super();
    log('new LinuxNativeNotifier()');

    // Signals that the notifier is implemented.
    this.isImplemented = true;
    // Toggles whether the reply is shown only when the reply window (concealed), or both in the notification and in the reply window.
    this.replyConceal = false;
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
    log('fireNotification() - ', JSON.stringify(this));
    const identifier = tag + ':::' + Date.now();

    var n = new Notification(manifest.productName, 'New message on Messenger', title, body);
    if (this.canReply) {
      log('Notification can reply');
      n.setReply(title, body);
    }
    n.on('reply', (message) => {
      var payload = {
        response: message
      };
      log('onReply(', message, ') ' + JSON.stringify(payload));
      onClick(payload);
    });

    n.on('create', () => {
      if (onCreate) {
        const data = {title, body, footer, timeout, tag, onClick, onCreate, identifier};
        onCreate(data);
      }
    });
    log('Showing libnotify-terminal notification ' + identifier);
    n.show();

    this.notifications[identifier] = n;
  }
}

export default LinuxNativeNotifier;
