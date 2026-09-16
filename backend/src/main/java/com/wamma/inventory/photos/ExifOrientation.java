package com.wamma.inventory.photos;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;

/**
 * Orientación EXIF de una foto JPEG. Los teléfonos guardan la foto "de lado" y anotan en
 * EXIF cómo girarla; como al procesarla se descartan los metadatos, hay que aplicar ese giro
 * antes, o la foto quedaría acostada.
 * <p>
 * Lee solo la etiqueta 0x0112 del primer directorio. Ante cualquier dato inesperado responde
 * 1 (sin giro): una orientación dudosa nunca debe impedir subir la foto.
 */
final class ExifOrientation {

    private static final int TAG_ORIENTATION = 0x0112;
    private static final byte[] EXIF_HEADER = "Exif\0\0".getBytes(StandardCharsets.US_ASCII);

    private ExifOrientation() {
    }

    static int read(byte[] jpeg) {
        try {
            int position = 2;
            while (position + 4 <= jpeg.length) {
                if ((jpeg[position] & 0xFF) != 0xFF) {
                    return 1;
                }
                int marker = jpeg[position + 1] & 0xFF;
                if (marker == 0xDA || marker == 0xD9) {
                    return 1;
                }
                int length = ((jpeg[position + 2] & 0xFF) << 8) | (jpeg[position + 3] & 0xFF);
                int payload = position + 4;
                if (marker == 0xE1 && startsWith(jpeg, payload, EXIF_HEADER)) {
                    return orientationFromTiff(jpeg, payload + EXIF_HEADER.length, payload + length - 2);
                }
                position += 2 + length;
            }
        } catch (RuntimeException e) {
            return 1;
        }
        return 1;
    }

    private static int orientationFromTiff(byte[] data, int tiff, int end) {
        boolean littleEndian = data[tiff] == 'I' && data[tiff + 1] == 'I';
        if (!littleEndian && !(data[tiff] == 'M' && data[tiff + 1] == 'M')) {
            return 1;
        }
        int ifd = tiff + int32(data, tiff + 4, littleEndian);
        int entries = int16(data, ifd, littleEndian);
        for (int i = 0; i < entries; i++) {
            int entry = ifd + 2 + i * 12;
            if (entry + 12 > end) {
                return 1;
            }
            if (int16(data, entry, littleEndian) == TAG_ORIENTATION) {
                int value = int16(data, entry + 8, littleEndian);
                return value >= 1 && value <= 8 ? value : 1;
            }
        }
        return 1;
    }

    /** Aplica la orientación: el resultado se ve como lo vio quien tomó la foto. */
    static BufferedImage apply(BufferedImage image, int orientation) {
        if (orientation <= 1 || orientation > 8) {
            return image;
        }
        int w = image.getWidth();
        int h = image.getHeight();
        boolean swaps = orientation >= 5;
        AffineTransform transform = switch (orientation) {
            case 2 -> new AffineTransform(-1, 0, 0, 1, w, 0);
            case 3 -> new AffineTransform(-1, 0, 0, -1, w, h);
            case 4 -> new AffineTransform(1, 0, 0, -1, 0, h);
            case 5 -> new AffineTransform(0, 1, 1, 0, 0, 0);
            case 6 -> new AffineTransform(0, 1, -1, 0, h, 0);
            case 7 -> new AffineTransform(0, -1, -1, 0, h, w);
            default -> new AffineTransform(0, -1, 1, 0, 0, w);
        };
        BufferedImage result = new BufferedImage(swaps ? h : w, swaps ? w : h, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = result.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
            graphics.drawImage(image, transform, null);
        } finally {
            graphics.dispose();
        }
        return result;
    }

    private static boolean startsWith(byte[] data, int offset, byte[] prefix) {
        if (offset + prefix.length > data.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (data[offset + i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private static int int16(byte[] data, int offset, boolean littleEndian) {
        int a = data[offset] & 0xFF;
        int b = data[offset + 1] & 0xFF;
        return littleEndian ? (b << 8) | a : (a << 8) | b;
    }

    private static int int32(byte[] data, int offset, boolean littleEndian) {
        int a = data[offset] & 0xFF;
        int b = data[offset + 1] & 0xFF;
        int c = data[offset + 2] & 0xFF;
        int d = data[offset + 3] & 0xFF;
        return littleEndian ? (d << 24) | (c << 16) | (b << 8) | a : (a << 24) | (b << 16) | (c << 8) | d;
    }
}
