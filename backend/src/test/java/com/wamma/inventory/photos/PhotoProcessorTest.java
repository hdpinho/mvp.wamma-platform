package com.wamma.inventory.photos;

import com.wamma.platform.web.ApiException;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Procesado de fotos (plan 005 §5): tamaños, formatos, metadatos y orientación. */
class PhotoProcessorTest {

    private static final String SECRET_PLACE = "UBICACION-SECRETA";

    private final PhotoProcessor processor = new PhotoProcessor();

    @Test
    void aPhotoWithGpsComesOutWithoutAnyMetadata() throws IOException {
        byte[] withExif = withExif(jpeg(400, 300, Color.GRAY, Color.GRAY), 1);
        assertThat(contains(withExif, SECRET_PLACE)).isTrue();

        PhotoProcessor.Processed processed = processor.process(withExif);

        for (byte[] output : new byte[][]{processed.large().jpeg(), processed.thumbnail().jpeg()}) {
            assertThat(contains(output, SECRET_PLACE)).isFalse();
            assertThat(contains(output, "Exif")).isFalse();
            assertThat(ImageIO.read(new ByteArrayInputStream(output))).isNotNull();
        }
    }

    @Test
    void largePhotosAreReducedKeepingTheirProportion() throws IOException {
        PhotoProcessor.Processed processed = processor.process(jpeg(4000, 3000, Color.RED, Color.BLUE));
        assertThat(processed.large().width()).isEqualTo(1600);
        assertThat(processed.large().height()).isEqualTo(1200);
        assertThat(processed.thumbnail().width()).isEqualTo(640);
        assertThat(processed.thumbnail().height()).isEqualTo(480);
        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(processed.large().jpeg()));
        assertThat(decoded.getWidth()).isEqualTo(1600);
    }

    @Test
    void smallPhotosAreNotEnlarged() throws IOException {
        PhotoProcessor.Processed processed = processor.process(jpeg(500, 300, Color.RED, Color.BLUE));
        assertThat(processed.large().width()).isEqualTo(500);
        assertThat(processed.thumbnail().width()).isEqualTo(500);
    }

    @Test
    void aPhoneRotatedPhotoIsTurnedUpright() throws IOException {
        // Mitad izquierda roja, derecha azul, y EXIF 6: "gírala 90° en sentido horario".
        byte[] rotated = withExif(jpeg(400, 200, Color.RED, Color.BLUE), 6);

        PhotoProcessor.Processed processed = processor.process(rotated);

        assertThat(processed.large().width()).isEqualTo(200);
        assertThat(processed.large().height()).isEqualTo(400);
        BufferedImage upright = ImageIO.read(new ByteArrayInputStream(processed.large().jpeg()));
        assertThat(new Color(upright.getRGB(100, 50)).getRed()).isGreaterThan(200);
        assertThat(new Color(upright.getRGB(100, 350)).getBlue()).isGreaterThan(200);
    }

    @Test
    void webpAndTransparentPngAreAccepted() throws IOException {
        byte[] webp;
        try (InputStream in = getClass().getResourceAsStream("/fotos/muestra-dominio-publico.webp")) {
            webp = in.readAllBytes();
        }
        PhotoProcessor.Processed fromWebp = processor.process(webp);
        assertThat(fromWebp.large().width()).isEqualTo(1000);
        assertThat(fromWebp.thumbnail().width()).isEqualTo(640);

        BufferedImage transparent = new BufferedImage(50, 50, BufferedImage.TYPE_INT_ARGB);
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(transparent, "png", png);
        BufferedImage flattened = ImageIO.read(new ByteArrayInputStream(processor.process(png.toByteArray()).large().jpeg()));
        assertThat(new Color(flattened.getRGB(25, 25)).getGreen()).isGreaterThan(240);
    }

    @Test
    void anythingElseIsRejectedWithAClearMessage() {
        assertThatThrownBy(() -> processor.process("hola".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getMessage()).isEqualTo("Solo se aceptan fotos JPEG, PNG o WebP."));

        byte[] tooBig = new byte[PhotoProcessor.MAX_BYTES + 1];
        tooBig[0] = (byte) 0xFF;
        tooBig[1] = (byte) 0xD8;
        tooBig[2] = (byte) 0xFF;
        assertThatThrownBy(() -> processor.process(tooBig))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getMessage()).contains("10 MB"));

        byte[] brokenJpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 1, 2, 3};
        assertThatThrownBy(() -> processor.process(brokenJpeg))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getMessage()).contains("No se pudo leer"));
    }

    private static byte[] jpeg(int width, int height, Color left, Color right) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(left);
        graphics.fillRect(0, 0, width / 2, height);
        graphics.setColor(right);
        graphics.fillRect(width / 2, 0, width - width / 2, height);
        graphics.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "jpeg", out);
        return out.toByteArray();
    }

    /**
     * Inserta, tras el APP0 de un JPEG, un APP1 EXIF con la orientación, una descripción que
     * hace de dato sensible y un directorio GPS, como el de una foto de teléfono.
     */
    private static byte[] withExif(byte[] jpeg, int orientation) {
        byte[] description = (SECRET_PLACE + "\0").getBytes(StandardCharsets.US_ASCII);
        int ifd0Entries = 3;
        int ifd0Size = 2 + ifd0Entries * 12 + 4;
        int gpsOffset = 8 + ifd0Size;
        int gpsSize = 2 + 12 + 4;
        int descriptionOffset = gpsOffset + gpsSize;

        ByteBuffer tiff = ByteBuffer.allocate(descriptionOffset + description.length);
        tiff.put((byte) 'M').put((byte) 'M').putShort((short) 42).putInt(8);
        tiff.putShort((short) ifd0Entries);
        tiff.putShort((short) 0x010E).putShort((short) 2).putInt(description.length).putInt(descriptionOffset);
        tiff.putShort((short) 0x0112).putShort((short) 3).putInt(1).putShort((short) orientation).putShort((short) 0);
        tiff.putShort((short) 0x8825).putShort((short) 4).putInt(1).putInt(gpsOffset);
        tiff.putInt(0);
        tiff.putShort((short) 1);
        tiff.putShort((short) 0x0001).putShort((short) 2).putInt(2).put((byte) 'N').put((byte) 0).putShort((short) 0);
        tiff.putInt(0);
        tiff.put(description);

        byte[] exifHeader = "Exif\0\0".getBytes(StandardCharsets.US_ASCII);
        int payloadLength = exifHeader.length + tiff.capacity();
        ByteBuffer app1 = ByteBuffer.allocate(4 + payloadLength);
        app1.put((byte) 0xFF).put((byte) 0xE1).putShort((short) (payloadLength + 2)).put(exifHeader).put(tiff.array());

        int app0Length = ((jpeg[4] & 0xFF) << 8) | (jpeg[5] & 0xFF);
        int insertAt = 4 + app0Length;
        byte[] result = new byte[jpeg.length + app1.capacity()];
        System.arraycopy(jpeg, 0, result, 0, insertAt);
        System.arraycopy(app1.array(), 0, result, insertAt, app1.capacity());
        System.arraycopy(jpeg, insertAt, result, insertAt + app1.capacity(), jpeg.length - insertAt);
        return result;
    }

    private static boolean contains(byte[] data, String text) {
        byte[] needle = text.getBytes(StandardCharsets.US_ASCII);
        outer:
        for (int i = 0; i <= data.length - needle.length; i++) {
            for (int j = 0; j < needle.length; j++) {
                if (data[i + j] != needle[j]) {
                    continue outer;
                }
            }
            return true;
        }
        return Arrays.equals(needle, new byte[0]);
    }
}
