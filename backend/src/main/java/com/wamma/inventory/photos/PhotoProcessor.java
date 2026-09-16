package com.wamma.inventory.photos;

import com.wamma.platform.web.ApiException;
import org.springframework.stereotype.Component;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Iterator;

/**
 * Procesado de las fotos de un vehículo (spec 005 RF-005.8, plan §5).
 * <p>
 * Cada foto se decodifica y se vuelve a codificar como JPEG en dos tamaños. Así:
 * <ul>
 *   <li>se descartan <b>todos</b> los metadatos, incluida la ubicación GPS (CA-005.8);</li>
 *   <li>la vitrina carga una miniatura liviana y la ficha una foto grande;</li>
 *   <li>cualquier navegador la muestra, aunque se haya subido en WebP o PNG.</li>
 * </ul>
 * El tipo se valida por la firma de bytes, no por la extensión ni por lo que diga el navegador.
 */
@Component
public class PhotoProcessor {

    public static final int MAX_BYTES = 10 * 1024 * 1024;
    public static final int LARGE = 1600;
    public static final int THUMBNAIL = 640;
    /** Por encima de esto la foto no cabe con holgura en la memoria del plan gratuito de Render. */
    static final long MAX_PIXELS = 100_000_000L;
    private static final float JPEG_QUALITY = 0.85f;

    static {
        // En un JAR de Spring Boot, ImageIO no siempre ve los lectores de TwelveMonkeys (WebP)
        // si se inicializó antes de cargar las dependencias.
        ImageIO.scanForPlugins();
    }

    public record Rendition(byte[] jpeg, int width, int height) {
    }

    public record Processed(Rendition large, Rendition thumbnail) {
    }

    public Processed process(byte[] input) {
        if (input == null || input.length == 0) {
            throw invalid("El archivo está vacío.");
        }
        if (input.length > MAX_BYTES) {
            throw invalid("La foto supera los 10 MB. Redúcela o expórtala en menor calidad.");
        }
        ImageFormat format = ImageFormat.detect(input);
        if (format == null) {
            throw invalid("Solo se aceptan fotos JPEG, PNG o WebP.");
        }
        BufferedImage image = decode(input);
        if (format == ImageFormat.JPEG) {
            image = ExifOrientation.apply(image, ExifOrientation.read(input));
        }
        BufferedImage opaque = flatten(image);
        return new Processed(render(opaque, LARGE), render(opaque, THUMBNAIL));
    }

    private static BufferedImage decode(byte[] input) {
        try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(input))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) {
                throw invalid("No se pudo leer la foto. Prueba con otro archivo.");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(stream, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if ((long) width * height > MAX_PIXELS) {
                    throw invalid("La foto tiene demasiados píxeles. Redúcela antes de subirla.");
                }
                // Una foto mucho mayor que el tamaño grande se lee ya reducida: ahorra memoria
                // y conserva el doble de resolución para una reducción suave.
                int factor = Math.max(1, Math.max(width, height) / (LARGE * 2));
                ImageReadParam param = reader.getDefaultReadParam();
                param.setSourceSubsampling(factor, factor, 0, 0);
                return reader.read(0, param);
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            if (e instanceof ApiException apiException) {
                throw apiException;
            }
            throw invalid("No se pudo leer la foto. Prueba con otro archivo.");
        }
    }

    /** JPEG no tiene transparencia: lo transparente queda blanco. */
    private static BufferedImage flatten(BufferedImage image) {
        BufferedImage result = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = result.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
            graphics.drawImage(image, 0, 0, null);
        } finally {
            graphics.dispose();
        }
        return result;
    }

    private static Rendition render(BufferedImage image, int maxSide) {
        BufferedImage scaled = scale(image, maxSide);
        return new Rendition(encodeJpeg(scaled), scaled.getWidth(), scaled.getHeight());
    }

    /** Reducción por mitades sucesivas: con interpolación bilineal, evita el efecto de sierra. */
    private static BufferedImage scale(BufferedImage image, int maxSide) {
        int width = image.getWidth();
        int height = image.getHeight();
        int longSide = Math.max(width, height);
        if (longSide <= maxSide) {
            return image;
        }
        double ratio = (double) maxSide / longSide;
        int targetWidth = Math.max(1, (int) Math.round(width * ratio));
        int targetHeight = Math.max(1, (int) Math.round(height * ratio));
        BufferedImage current = image;
        int currentWidth = width;
        int currentHeight = height;
        do {
            currentWidth = Math.max(targetWidth, currentWidth / 2);
            currentHeight = Math.max(targetHeight, currentHeight / 2);
            BufferedImage next = new BufferedImage(currentWidth, currentHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = next.createGraphics();
            try {
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                graphics.drawImage(current, 0, 0, currentWidth, currentHeight, null);
            } finally {
                graphics.dispose();
            }
            current = next;
        } while (currentWidth != targetWidth || currentHeight != targetHeight);
        return current;
    }

    /** Sin metadatos: {@code IIOImage} sin árbol de metadatos ni miniaturas incrustadas. */
    private static byte[] encodeJpeg(BufferedImage image) {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            throw new IllegalStateException("La JVM no tiene codificador JPEG");
        }
        ImageWriter writer = writers.next();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ImageOutputStream stream = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(stream);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(JPEG_QUALITY);
            writer.write(null, new IIOImage(image, null, null), param);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo codificar la foto", e);
        } finally {
            writer.dispose();
        }
        return out.toByteArray();
    }

    private static ApiException invalid(String detail) {
        return ApiException.badRequest("Foto no válida", detail);
    }

    /** Formatos aceptados, reconocidos por su firma de bytes. */
    enum ImageFormat {
        JPEG, PNG, WEBP;

        static ImageFormat detect(byte[] data) {
            if (data.length >= 3 && (data[0] & 0xFF) == 0xFF && (data[1] & 0xFF) == 0xD8 && (data[2] & 0xFF) == 0xFF) {
                return JPEG;
            }
            if (data.length >= 8 && (data[0] & 0xFF) == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G'
                    && data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A) {
                return PNG;
            }
            if (data.length >= 12 && data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F'
                    && data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P') {
                return WEBP;
            }
            return null;
        }
    }
}
