"""
Telegram notification client for sending suggestions via Telegram Bot API.
"""

import os
import requests


TELEGRAM_API_URL = "https://api.telegram.org/bot"


def _get_token() -> str:
    """Get the Telegram bot token from environment."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise ValueError("TELEGRAM_BOT_TOKEN environment variable is not set")
    return token


def send_message(chat_id: str, text: str) -> dict:
    """
    Send a text message via Telegram Bot API.

    Args:
        chat_id: The Telegram chat ID to send the message to.
        text: The message text to send.

    Returns:
        The JSON response from the Telegram API.

    Raises:
        ValueError: If TELEGRAM_BOT_TOKEN is not set.
        requests.HTTPError: If the API request fails.
    """
    token = _get_token()
    url = f"{TELEGRAM_API_URL}{token}/sendMessage"

    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }

    response = requests.post(url, json=payload, timeout=30)
    response.raise_for_status()
    return response.json()


def send_suggestion(chat_id: str, text: str) -> dict:
    """
    Send a roleplay suggestion to a Telegram chat.

    This formats the suggestion with proper emoji and structure
    as defined in the app spec (section 8).

    Args:
        chat_id: The Telegram chat ID to send the suggestion to.
        text: The suggestion text (already formatted with character name,
              moment type, suggestion content, and timestamp).

    Returns:
        The JSON response from the Telegram API.

    Raises:
        ValueError: If TELEGRAM_BOT_TOKEN is not set.
        requests.HTTPError: If the API request fails.
    """
    return send_message(chat_id, text)
