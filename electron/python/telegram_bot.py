"""
Telegram bot module using raw requests (no heavy library dependency).
"""

import os
import json
import logging
import threading
import time
import urllib.request
import urllib.parse
import urllib.error

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TelegramBot:
    """Telegram bot with long-polling loop and DM capability."""

    def __init__(self, token=None):
        """
        Initialize the Telegram bot.

        Args:
            token: Bot token. If None, reads from TELEGRAM_BOT_TOKEN env var
                   or from ~/.hermes/telegram_bot_token file.
        """
        if token is None:
            token = os.environ.get('TELEGRAM_BOT_TOKEN')
            if token is None:
                token_path = os.path.expanduser('~/.hermes/telegram_bot_token')
                if os.path.exists(token_path):
                    with open(token_path, 'r') as f:
                        token = f.read().strip()

        if not token:
            raise ValueError("Telegram bot token not provided and could not be loaded")

        self.token = token
        self.base_url = f"https://api.telegram.org/bot{token}"
        self._running = False
        self._offset = 0
        self._lock = threading.Lock()
        self._started = threading.Event()   # set once start() enters the loop

    def start(self) -> None:
        """Start the long-polling loop (blocking)."""
        self._running = True
        self._started.set()
        logger.info("Telegram bot started")

        while self._running:
            try:
                update = self._poll()
                if update:
                    self._handle_update(update)
                    if 'update_id' in update:
                        self._offset = update['update_id'] + 1
            except Exception as e:
                logger.warning(f"Error in polling loop: {e}")
                time.sleep(5)

    def stop(self) -> None:
        """Stop the long-polling loop."""
        logger.info("Telegram bot stopping")
        with self._lock:
            self._running = False

    def send_message(self, telegram_handle: str, text: str) -> bool:
        """
        Send a DM to a user by their Telegram handle (without @).

        Returns True if sent successfully, False otherwise.
        """
        chat_id = self._get_chat_id(telegram_handle)
        if chat_id is None:
            logger.warning(f"Could not find chat_id for handle: {telegram_handle}")
            return False
        return self._send_message(chat_id, text)

    def _poll(self) -> dict | None:
        """Long-poll getUpdates from Telegram API."""
        url = f"{self.base_url}/getUpdates"
        params = {'offset': self._offset, 'timeout': 30}

        try:
            query = urllib.parse.urlencode(params)
            req = urllib.request.Request(f"{url}?{query}", method='GET')

            with urllib.request.urlopen(req, timeout=35) as response:
                data = json.loads(response.read().decode('utf-8'))

            if data.get('ok') and data.get('result'):
                updates = data['result']
                if updates:
                    return updates[0]
            return None

        except urllib.error.HTTPError as e:
            logger.warning(f"HTTP error during poll: {e.code} {e.reason}")
            return None
        except urllib.error.URLError as e:
            logger.warning(f"Network error during poll: {e.reason}")
            return None
        except Exception as e:
            logger.warning(f"Unexpected error during poll: {e}")
            return None

    def _handle_update(self, update: dict) -> None:
        """Process an incoming update."""
        try:
            message = update.get('message')
            if not message:
                return
            chat_id = message.get('chat', {}).get('id')
            text = message.get('text', '')

            if not text or not chat_id:
                return

            if text.startswith('/'):
                command = text.split()[0].lstrip('/')
                self._handle_command(chat_id, command)
            else:
                logger.info(f"Received message from {chat_id}: {text[:50]}...")
        except Exception as e:
            logger.warning(f"Error handling update: {e}")

    def _handle_command(self, chat_id: int, command: str) -> None:
        """Handle /start and /status commands."""
        if command == 'start':
            self._send_message(chat_id, "Welcome! I send you Game Master suggestions during your sessions.")
        elif command == 'status':
            self._send_message(chat_id, "Bot is running. You'll receive suggestions automatically during sessions.")
        else:
            self._send_message(chat_id, f"Unknown command: /{command}")

    def _get_chat_id(self, telegram_handle: str):
        """Look up chat_id from a @handle via getChat API."""
        url = f"{self.base_url}/getChat"
        params = {'chat_id': f'@{telegram_handle}'}

        try:
            query = urllib.parse.urlencode(params)
            req = urllib.request.Request(f"{url}?{query}", method='GET')

            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))

            if data.get('ok'):
                return data['result'].get('id')
            return None
        except Exception as e:
            logger.warning(f"Error getting chat_id for {telegram_handle}: {e}")
            return None

    def _send_message(self, chat_id: int, text: str) -> bool:
        """Send text via sendMessage API."""
        url = f"{self.base_url}/sendMessage"
        params = {'chat_id': chat_id, 'text': text}

        try:
            data = urllib.parse.urlencode(params).encode('utf-8')
            req = urllib.request.Request(url, data=data, method='POST')

            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode('utf-8'))

            return result.get('ok', False)
        except urllib.error.HTTPError as e:
            logger.warning(f"HTTP error sending message: {e.code} {e.reason}")
            return False
        except urllib.error.URLError as e:
            logger.warning(f"Network error sending message: {e.reason}")
            return False
        except Exception as e:
            logger.warning(f"Error sending message: {e}")
            return False


def send_dm(handle: str, text: str) -> bool:
    """
    Standalone function to send a DM to a Telegram user.
    Creates a temporary TelegramBot instance, looks up chat_id, sends message.
    Does not persist bot state (no long-poll offset tracking needed for sending).
    """
    bot = TelegramBot()  # loads token from env or ~/.hermes/telegram_bot_token
    return bot.send_message(handle, text)


if __name__ == '__main__':
    try:
        bot = TelegramBot()
        bot.start()
    except KeyboardInterrupt:
        bot.stop()
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Bot error: {e}")