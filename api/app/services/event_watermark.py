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

JPEG_QUALITY = 88


# --------------------------------------------------
# FONT HELPERS
# --------------------------------------------------


def _font_candidates(
    bold: bool = True,
) -> list[str]:
    if bold:
        return [
            # Windows
            r"C:\Windows\Fonts\segoeuib.ttf",
            r"C:\Windows\Fonts\arialbd.ttf",

            # Linux / Render
            (
                "/usr/share/fonts/truetype/"
                "dejavu/DejaVuSans-Bold.ttf"
            ),
            (
                "/usr/share/fonts/truetype/"
                "liberation2/LiberationSans-Bold.ttf"
            ),
        ]

    return [
        # Windows
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",

        # Linux / Render
        (
            "/usr/share/fonts/truetype/"
            "dejavu/DejaVuSans.ttf"
        ),
        (
            "/usr/share/fonts/truetype/"
            "liberation2/LiberationSans-Regular.ttf"
        ),
    ]


def _load_font(
    size: int,
    bold: bool = True,
):
    for candidate in _font_candidates(
        bold=bold
    ):
        try:
            if Path(candidate).exists():
                return ImageFont.truetype(
                    candidate,
                    size=size,
                )

        except OSError:
            continue

    return ImageFont.load_default()


# --------------------------------------------------
# BRAND
# --------------------------------------------------


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


# --------------------------------------------------
# IMAGE PREPARATION
# --------------------------------------------------


def _prepare_image(
    original_bytes: bytes,
) -> Image.Image:
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
        if (
            "A"
            in source.getbands()
        ):
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


    # Keep customer preview sharp.
    # No artificial blur.
    return source


# --------------------------------------------------
# MAIN REPEATED WATERMARK
# --------------------------------------------------


def _apply_main_watermark(
    image: Image.Image,
    brand_name: str,
) -> Image.Image:
    """
    Clear classic watermark using the photographer /
    workspace name.

    Designed to:
    - remain clearly visible
    - use fewer rows than the original watermark
    - preserve enough space to judge the photo
    - protect against casual screenshot reuse
    """

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


    # Photographer/workspace branding only.
    #
    # Examples:
    # MIRUL PHOTOGRAPHY
    # TESTPHOTOGRAPHYXXXX
    watermark_text = (
        brand_name.upper()
    )


    # Large and readable, similar to the first
    # watermark version that was clearly visible.
    font_size = max(
        34,
        min(
            68,
            int(
                width
                * 0.040
            ),
        ),
    )


    font = _load_font(
        size=font_size,
        bold=True,
    )


    bbox = draw.textbbox(
        (
            0,
            0,
        ),
        watermark_text,
        font=font,
    )


    text_width = (
        bbox[2]
        - bbox[0]
    )

    text_height = (
        bbox[3]
        - bbox[1]
    )


    # --------------------------------------------------
    # HORIZONTAL SPACING
    # --------------------------------------------------

    x_gap = max(
        105,
        int(
            width
            * 0.065
        ),
    )


    x_step = (
        text_width
        + x_gap
    )


    # --------------------------------------------------
    # VERTICAL SPACING
    # --------------------------------------------------
    #
    # Main improvement over the original:
    # around 3–4 rows instead of many rows.
    #

    y_step = max(
        int(
            height
            * 0.245
        ),
        text_height
        + 95,
    )


    start_y = max(
        30,
        int(
            height
            * 0.065
        ),
    )


    # Leave room for footer.
    bottom_limit = (
        height
        - max(
            80,
            int(
                height
                * 0.10
            ),
        )
    )


    row = 0
    y = start_y


    while (
        y
        < bottom_limit
        - text_height
    ):
        # Alternate rows so the watermark doesn't
        # create straight empty vertical channels.
        offset = (
            -int(
                x_step
                * 0.50
            )
            if row % 2
            else 0
        )


        x = offset


        while x < width:
            # Dark shadow for visibility on bright areas.
            draw.text(
                (
                    x + 2,
                    y + 2,
                ),
                watermark_text,
                font=font,
                fill=(
                    0,
                    0,
                    0,
                    58,
                ),
            )


            # Main white watermark.
            #
            # Clear, but not as strong as the
            # original first implementation.
            draw.text(
                (
                    x,
                    y,
                ),
                watermark_text,
                font=font,
                fill=(
                    255,
                    255,
                    255,
                    112,
                ),
            )


            x += x_step


        y += y_step
        row += 1


    return Image.alpha_composite(
        image,
        overlay,
    )


# --------------------------------------------------
# PROFESSIONAL FOOTER
# --------------------------------------------------


def _apply_footer(
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


    footer_height = max(
        66,
        min(
            100,
            int(
                height
                * 0.082
            ),
        ),
    )


    top = (
        height
        - footer_height
    )


    # Premium translucent teal footer.
    draw.rectangle(
        (
            0,
            top,
            width,
            height,
        ),
        fill=(
            7,
            45,
            58,
            165,
        ),
    )


    # Thin divider.
    draw.line(
        (
            0,
            top,
            width,
            top,
        ),
        fill=(
            255,
            255,
            255,
            48,
        ),
        width=1,
    )


    # --------------------------------------------------
    # FONTS
    # --------------------------------------------------

    brand_font = _load_font(
        size=max(
            19,
            min(
                30,
                int(
                    width
                    * 0.018
                ),
            ),
        ),
        bold=True,
    )


    detail_font = _load_font(
        size=max(
            13,
            min(
                18,
                int(
                    width
                    * 0.0105
                ),
            ),
        ),
        bold=False,
    )


    center_font = _load_font(
        size=max(
            14,
            min(
                20,
                int(
                    width
                    * 0.012
                ),
            ),
        ),
        bold=True,
    )


    padding_x = max(
        22,
        int(
            width
            * 0.018
        ),
    )


    # --------------------------------------------------
    # LEFT — PHOTOGRAPHER BRAND
    # --------------------------------------------------

    brand_text = (
        brand_name
    )


    protection_text = (
        "Protected customer preview"
    )


    brand_bbox = draw.textbbox(
        (
            0,
            0,
        ),
        brand_text,
        font=brand_font,
    )


    brand_height = (
        brand_bbox[3]
        - brand_bbox[1]
    )


    protection_bbox = draw.textbbox(
        (
            0,
            0,
        ),
        protection_text,
        font=detail_font,
    )


    protection_height = (
        protection_bbox[3]
        - protection_bbox[1]
    )


    left_block_height = (
        brand_height
        + protection_height
        + 5
    )


    left_y = (
        top
        + (
            footer_height
            - left_block_height
        )
        // 2
    )


    draw.text(
        (
            padding_x,
            left_y,
        ),
        brand_text,
        font=brand_font,
        fill=(
            255,
            255,
            255,
            245,
        ),
    )


    draw.text(
        (
            padding_x,
            left_y
            + brand_height
            + 5,
        ),
        protection_text,
        font=detail_font,
        fill=(
            215,
            238,
            242,
            220,
        ),
    )


    # --------------------------------------------------
    # CENTER — EZFOTOO PROTECTION LABEL
    # --------------------------------------------------

    center_text = (
        "PROTECTED PREVIEW"
    )


    center_bbox = draw.textbbox(
        (
            0,
            0,
        ),
        center_text,
        font=center_font,
    )


    center_width = (
        center_bbox[2]
        - center_bbox[0]
    )

    center_height = (
        center_bbox[3]
        - center_bbox[1]
    )


    draw.text(
        (
            (
                width
                - center_width
            )
            // 2,

            top
            + (
                footer_height
                - center_height
            )
            // 2,
        ),
        center_text,
        font=center_font,
        fill=(
            255,
            255,
            255,
            225,
        ),
    )


    # --------------------------------------------------
    # RIGHT — EZFOTOO SECONDARY BRANDING
    # --------------------------------------------------

    powered_text = (
        "Powered by EZFOTOO"
    )


    private_text = (
        "Original remains private"
    )


    powered_bbox = draw.textbbox(
        (
            0,
            0,
        ),
        powered_text,
        font=detail_font,
    )


    powered_width = (
        powered_bbox[2]
        - powered_bbox[0]
    )

    powered_height = (
        powered_bbox[3]
        - powered_bbox[1]
    )


    private_bbox = draw.textbbox(
        (
            0,
            0,
        ),
        private_text,
        font=detail_font,
    )


    private_width = (
        private_bbox[2]
        - private_bbox[0]
    )

    private_height = (
        private_bbox[3]
        - private_bbox[1]
    )


    right_block_height = (
        powered_height
        + private_height
        + 5
    )


    right_y = (
        top
        + (
            footer_height
            - right_block_height
        )
        // 2
    )


    draw.text(
        (
            width
            - padding_x
            - powered_width,

            right_y,
        ),
        powered_text,
        font=detail_font,
        fill=(
            235,
            246,
            248,
            220,
        ),
    )


    draw.text(
        (
            width
            - padding_x
            - private_width,

            right_y
            + powered_height
            + 5,
        ),
        private_text,
        font=detail_font,
        fill=(
            200,
            224,
            229,
            190,
        ),
    )


    return Image.alpha_composite(
        image,
        overlay,
    )


# --------------------------------------------------
# MAIN PUBLIC SERVICE
# --------------------------------------------------


def create_professional_watermarked_preview(
    original_bytes: bytes,
    brand_name: str | None,
) -> bytes:
    """
    EZFOTOO protected event preview.

    Final classic design:

    - photographer/workspace name repeated
      across the image
    - no EZFOTOO repeated over photography
    - approximately 3–4 watermark rows
    - strong enough for protection
    - photo stays sharp
    - photographer branding remains primary
    - EZFOTOO appears subtly in footer
    """

    source = _prepare_image(
        original_bytes
    )


    brand = _clean_brand_name(
        brand_name
    )


    protected = source.convert(
        "RGBA"
    )


    protected = _apply_main_watermark(
        image=
            protected,

        brand_name=
            brand,
    )


    protected = _apply_footer(
        image=
            protected,

        brand_name=
            brand,
    )


    output = io.BytesIO()


    protected.convert(
        "RGB"
    ).save(
        output,
        format="JPEG",
        quality=
            JPEG_QUALITY,
        optimize=True,
        progressive=True,
    )


    return output.getvalue()


# --------------------------------------------------
# COMPATIBILITY ALIASES
# --------------------------------------------------


def create_event_watermarked_preview(
    original_bytes: bytes,
    brand_name: str | None,
) -> bytes:
    return (
        create_professional_watermarked_preview(
            original_bytes=
                original_bytes,

            brand_name=
                brand_name,
        )
    )


def create_watermarked_preview(
    original_bytes: bytes,
    brand_name: str | None,
) -> bytes:
    return (
        create_professional_watermarked_preview(
            original_bytes=
                original_bytes,

            brand_name=
                brand_name,
        )
    )