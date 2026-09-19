from __future__ import annotations

import io
from pathlib import Path

from PIL import (
    Image,
    ImageDraw,
    ImageFont,
    ImageOps,
)


PREVIEW_MAX_SIZE = (
    1800,
    1800,
)

JPEG_QUALITY = 84


def _font_candidates() -> list[str]:
    return [
        # Windows
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",

        # Linux / Render
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    ]


def _load_font(
    size: int,
):
    for candidate in _font_candidates():
        try:
            if Path(candidate).exists():
                return ImageFont.truetype(
                    candidate,
                    size=size,
                )

        except OSError:
            continue

    return ImageFont.load_default()


def _clean_brand_name(
    brand_name: str | None,
) -> str:
    cleaned = (
        brand_name
        or "EZFOTOO"
    ).strip()

    if not cleaned:
        return "EZFOTOO"

    return cleaned[:42]


def _build_diagonal_mark(
    text: str,
    font_size: int,
) -> Image.Image:
    font = _load_font(
        font_size
    )

    temporary = Image.new(
        "RGBA",
        (
            1200,
            300,
        ),
        (
            0,
            0,
            0,
            0,
        ),
    )

    draw = ImageDraw.Draw(
        temporary
    )

    box = draw.textbbox(
        (
            0,
            0,
        ),
        text,
        font=font,
        stroke_width=1,
    )

    text_width = (
        box[2]
        - box[0]
    )

    text_height = (
        box[3]
        - box[1]
    )

    horizontal_padding = max(
        40,
        font_size,
    )

    vertical_padding = max(
        25,
        int(
            font_size
            * 0.7
        ),
    )

    tile = Image.new(
        "RGBA",
        (
            text_width
            + horizontal_padding * 2,
            text_height
            + vertical_padding * 2,
        ),
        (
            0,
            0,
            0,
            0,
        ),
    )

    tile_draw = ImageDraw.Draw(
        tile
    )

    x = horizontal_padding
    y = vertical_padding

    # Very subtle shadow.
    tile_draw.text(
        (
            x + 2,
            y + 2,
        ),
        text,
        font=font,
        fill=(
            0,
            0,
            0,
            34,
        ),
        stroke_width=1,
        stroke_fill=(
            0,
            0,
            0,
            22,
        ),
    )

    # Main watermark.
    tile_draw.text(
        (
            x,
            y,
        ),
        text,
        font=font,
        fill=(
            255,
            255,
            255,
            72,
        ),
        stroke_width=1,
        stroke_fill=(
            0,
            0,
            0,
            30,
        ),
    )

    return tile.rotate(
        27,
        expand=True,
        resample=
            Image.Resampling.BICUBIC,
    )


def _apply_pattern(
    image: Image.Image,
    brand_name: str,
) -> Image.Image:
    width, height = (
        image.size
    )

    overlay = Image.new(
        "RGBA",
        image.size,
        (
            0,
            0,
            0,
            0,
        ),
    )

    display_name = (
        brand_name.upper()
    )

    font_size = max(
        24,
        min(
            58,
            int(
                width * 0.032
            ),
        ),
    )

    mark = _build_diagonal_mark(
        display_name,
        font_size,
    )

    mark_width, mark_height = (
        mark.size
    )

    x_step = max(
        int(
            mark_width
            * 1.25
        ),
        320,
    )

    y_step = max(
        int(
            mark_height
            * 1.40
        ),
        220,
    )

    row = 0

    for y in range(
        -mark_height,
        height + mark_height,
        y_step,
    ):
        offset = (
            -int(
                x_step / 2
            )
            if row % 2
            else 0
        )

        for x in range(
            -mark_width + offset,
            width + mark_width,
            x_step,
        ):
            overlay.paste(
                mark,
                (
                    x,
                    y,
                ),
                mark,
            )

        row += 1

    return Image.alpha_composite(
        image,
        overlay,
    )


def _apply_brand_badge(
    image: Image.Image,
    brand_name: str,
) -> Image.Image:
    width, height = (
        image.size
    )

    overlay = Image.new(
        "RGBA",
        image.size,
        (
            0,
            0,
            0,
            0,
        ),
    )

    draw = ImageDraw.Draw(
        overlay
    )

    margin = max(
        18,
        int(
            width * 0.018
        ),
    )

    brand_font_size = max(
        17,
        min(
            34,
            int(
                width * 0.020
            ),
        ),
    )

    detail_font_size = max(
        11,
        min(
            19,
            int(
                width * 0.011
            ),
        ),
    )

    brand_font = _load_font(
        brand_font_size
    )

    detail_font = _load_font(
        detail_font_size
    )

    brand_text = (
        brand_name
    )

    detail_text = (
        "PROTECTED PREVIEW  •  Powered by EZFOTOO"
    )

    brand_box = draw.textbbox(
        (
            0,
            0,
        ),
        brand_text,
        font=brand_font,
    )

    detail_box = draw.textbbox(
        (
            0,
            0,
        ),
        detail_text,
        font=detail_font,
    )

    brand_width = (
        brand_box[2]
        - brand_box[0]
    )

    brand_height = (
        brand_box[3]
        - brand_box[1]
    )

    detail_width = (
        detail_box[2]
        - detail_box[0]
    )

    detail_height = (
        detail_box[3]
        - detail_box[1]
    )

    padding_x = max(
        18,
        int(
            width * 0.014
        ),
    )

    padding_y = max(
        13,
        int(
            width * 0.009
        ),
    )

    line_gap = max(
        5,
        int(
            width * 0.004
        ),
    )

    badge_width = (
        max(
            brand_width,
            detail_width,
        )
        + padding_x * 2
    )

    badge_height = (
        brand_height
        + detail_height
        + line_gap
        + padding_y * 2
    )

    max_badge_width = (
        width
        - margin * 2
    )

    badge_width = min(
        badge_width,
        max_badge_width,
    )

    left = (
        width
        - badge_width
        - margin
    )

    top = (
        height
        - badge_height
        - margin
    )

    right = (
        width
        - margin
    )

    bottom = (
        height
        - margin
    )

    radius = max(
        12,
        int(
            badge_height * 0.18
        ),
    )

    # Soft outer shadow.
    shadow_offset = max(
        4,
        int(
            width * 0.003
        ),
    )

    draw.rounded_rectangle(
        (
            left + shadow_offset,
            top + shadow_offset,
            right + shadow_offset,
            bottom + shadow_offset,
        ),
        radius=radius,
        fill=(
            0,
            0,
            0,
            58,
        ),
    )

    # Deep teal glass-style badge.
    draw.rounded_rectangle(
        (
            left,
            top,
            right,
            bottom,
        ),
        radius=radius,
        fill=(
            7,
            59,
            76,
            208,
        ),
        outline=(
            255,
            255,
            255,
            42,
        ),
        width=1,
    )

    text_x = (
        left
        + padding_x
    )

    brand_y = (
        top
        + padding_y
    )

    detail_y = (
        brand_y
        + brand_height
        + line_gap
    )

    draw.text(
        (
            text_x,
            brand_y,
        ),
        brand_text,
        font=brand_font,
        fill=(
            255,
            255,
            255,
            242,
        ),
    )

    draw.text(
        (
            text_x,
            detail_y,
        ),
        detail_text,
        font=detail_font,
        fill=(
            207,
            235,
            239,
            225,
        ),
    )

    return Image.alpha_composite(
        image,
        overlay,
    )


def create_professional_watermarked_preview(
    original_bytes: bytes,
    brand_name: str | None,
) -> bytes:
    """
    Produce a professional protected preview.

    The original image is never modified.

    Design:
    - EXIF orientation correction
    - maximum preview dimensions
    - subtle diagonal photographer branding
    - premium lower-right protection badge
    - optimized JPEG output
    """

    try:
        source = Image.open(
            io.BytesIO(
                original_bytes
            )
        )

        source = ImageOps.exif_transpose(
            source
        )

        source.load()

    except Exception as exc:
        raise RuntimeError(
            "The original image could not be decoded."
        ) from exc

    if source.mode != "RGB":
        if "A" in source.getbands():
            rgba = source.convert(
                "RGBA"
            )

            background = Image.new(
                "RGB",
                source.size,
                "white",
            )

            background.paste(
                rgba,
                mask=
                    rgba.getchannel(
                        "A"
                    ),
            )

            source = background

        else:
            source = source.convert(
                "RGB"
            )

    source.thumbnail(
        PREVIEW_MAX_SIZE,
        Image.Resampling.LANCZOS,
    )

    brand = _clean_brand_name(
        brand_name
    )

    protected = source.convert(
        "RGBA"
    )

    protected = _apply_pattern(
        protected,
        brand,
    )

    protected = _apply_brand_badge(
        protected,
        brand,
    )

    output = io.BytesIO()

    protected.convert(
        "RGB"
    ).save(
        output,
        format="JPEG",
        quality=JPEG_QUALITY,
        optimize=True,
        progressive=True,
    )

    return output.getvalue()