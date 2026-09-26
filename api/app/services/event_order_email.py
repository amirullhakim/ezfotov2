from __future__ import annotations

from dataclasses import dataclass
from html import escape
from typing import TYPE_CHECKING
from urllib.parse import urlsplit

if TYPE_CHECKING:
    from app.models.event_order import EventOrder


@dataclass(frozen=True)
class EventOrderEmail:
    to_email: str
    subject: str
    html: str
    text: str
    reply_to: str


def _money(cents: int, currency: str) -> str:
    prefix = "RM" if currency == "MYR" else f"{currency} "
    return f"{prefix}{cents // 100:,}.{cents % 100:02d}"


def render_paid_order_email(
    *,
    order: EventOrder,
    delivery_url: str,
    event_title: str | None = None,
    reply_to: str = "ezfotoo@gmail.com",
) -> EventOrderEmail:
    """Render a verified paid-order snapshot; this function does not send email.

    The caller must supply an order loaded by the backend and a delivery URL
    constructed by trusted backend code. Never accept either from a customer
    request as proof of payment. Sending and duplicate prevention belong to
    the payment-delivery integration.
    """
    if order.status != "PAID":
        raise ValueError("Confirmation email requires a PAID order.")

    amounts = (
        order.regular_subtotal_cents,
        order.discount_cents,
        order.photo_subtotal_cents,
        order.service_fee_cents,
        order.total_cents,
    )
    if any(type(value) is not int or value < 0 for value in amounts):
        raise ValueError("Order amounts must be nonnegative integer cents.")
    if type(order.item_count) is not int or order.item_count < 1:
        raise ValueError("Order must contain at least one photo.")
    if (
        order.regular_subtotal_cents - order.discount_cents
        != order.photo_subtotal_cents
        or order.photo_subtotal_cents + order.service_fee_cents
        != order.total_cents
    ):
        raise ValueError("Order pricing breakdown does not match its total.")

    currency = order.currency.strip().upper()
    if len(currency) != 3 or not currency.isascii() or not currency.isalpha():
        raise ValueError("Order currency must be a three-letter code.")
    if any(char in order.order_number for char in "\r\n"):
        raise ValueError("Invalid order number.")

    delivery_url = delivery_url.strip()
    parts = urlsplit(delivery_url)
    local_http = parts.scheme == "http" and parts.hostname in {
        "localhost", "127.0.0.1", "::1"
    }
    if (
        not parts.hostname
        or (parts.scheme != "https" and not local_http)
        or parts.username is not None
        or parts.password is not None
        or any(char.isspace() or ord(char) < 32 for char in delivery_url)
    ):
        raise ValueError("Delivery URL must use HTTPS, or HTTP on localhost.")

    recipient = order.customer_email.strip()
    reply_to = reply_to.strip()
    if any(not address or "@" not in address or any(
        char.isspace() or ord(char) < 32 for char in address
    ) for address in (recipient, reply_to)):
        raise ValueError("A valid customer email and reply address are required.")

    name = order.customer_name.strip() or "there"
    title = (event_title or "").strip()
    subject = f"Payment confirmed | {order.order_number} | EZFOTOO"
    summary = [("Photos", str(order.item_count))]
    if order.discount_cents:
        summary.extend([
            ("Regular subtotal", _money(order.regular_subtotal_cents, currency)),
            ("Bundle savings", "-" + _money(order.discount_cents, currency)),
        ])
    summary.extend([
        ("Photo subtotal", _money(order.photo_subtotal_cents, currency)),
        ("Service fee", _money(order.service_fee_cents, currency)),
    ])
    total = _money(order.total_cents, currency)
    rows = "".join(
        '<tr><td style="padding:9px 0;color:#52656a;">'
        f'{escape(label)}</td><td align="right" style="padding:9px 0;'
        f'color:#062f38;font-weight:600;">{escape(value)}</td></tr>'
        for label, value in summary
    )
    event_line = (
        f'<p style="margin:8px 0 0;color:#52656a;">{escape(title)}</p>'
        if title else ""
    )
    safe_url = escape(delivery_url, quote=True)
    safe_reply = escape(reply_to, quote=True)

    html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3fcfc;font-family:Arial,Helvetica,sans-serif;color:#062f38;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your payment is confirmed. View and download your purchased photos.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3fcfc;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dcebed;border-radius:16px;">
<tr><td style="padding:28px 28px 22px;background:#062f38;border-radius:16px 16px 0 0;">
<p style="margin:0;color:#ffffff;font-size:23px;font-weight:700;letter-spacing:2px;">EZFOTOO</p>
<p style="margin:8px 0 0;color:#a9e9ed;font-size:13px;">Your moments, ready to keep.</p>
</td></tr>
<tr><td style="padding:28px;">
<p style="margin:0 0 14px;color:#0d5c68;font-size:12px;font-weight:700;letter-spacing:1px;">PAYMENT CONFIRMED</p>
<h1 style="margin:0 0 18px;font-size:28px;line-height:1.25;">Your photos are ready.</h1>
<p style="margin:0 0 10px;font-size:16px;line-height:1.6;">Hi {escape(name)},</p>
<p style="margin:0 0 24px;color:#52656a;font-size:15px;line-height:1.6;">Thank you for your purchase. Your payment has been confirmed, and you can now access your original photos.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3fcfc;border:1px solid #dcebed;border-radius:12px;">
<tr><td style="padding:20px;">
<p style="margin:0 0 6px;color:#52656a;font-size:12px;">ORDER NUMBER</p>
<p style="margin:0;font-size:16px;font-weight:700;overflow-wrap:anywhere;">{escape(order.order_number)}</p>
{event_line}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;font-size:14px;">
{rows}
<tr><td style="padding-top:16px;border-top:1px solid #cddfe2;font-weight:700;">Total paid</td>
<td align="right" style="padding-top:16px;border-top:1px solid #cddfe2;font-size:20px;font-weight:700;">{escape(total)}</td></tr>
</table></td></tr></table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:26px;">
<tr><td align="center" bgcolor="#0d5c68" style="border-radius:10px;">
<a href="{safe_url}" style="display:block;padding:17px 12px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">View &amp; download photos</a>
</td></tr></table>
<p style="margin:18px 0 0;color:#52656a;font-size:12px;line-height:1.6;">Keep this email to access your photos again. This link gives access to your purchased photos, so please keep it private.</p>
<p style="margin:24px 0 0;color:#52656a;font-size:13px;line-height:1.6;">Need help? Reply to this email or contact <a href="mailto:{safe_reply}" style="color:#0d5c68;">{safe_reply}</a>.</p>
</td></tr></table>
<p style="margin:18px 0 0;color:#647b80;font-size:12px;">EZFOTOO &middot; Event photography</p>
</td></tr></table></body></html>'''

    text_lines = [
        "EZFOTOO - Payment confirmed", "", f"Hi {name},", "",
        "Thank you for your purchase. Your original photos are ready.", "",
        f"Order: {order.order_number}",
    ]
    if title:
        text_lines.append(f"Event: {title}")
    text_lines.extend(f"{label}: {value}" for label, value in summary)
    text_lines.extend([
        f"Total paid: {total}", "", "View and download photos:",
        delivery_url, "", "Keep this email and keep your access link private.",
        f"Need help? Reply to this email or contact {reply_to}.",
    ])
    return EventOrderEmail(
        to_email=recipient, subject=subject, html=html,
        text="\n".join(text_lines), reply_to=reply_to,
    )