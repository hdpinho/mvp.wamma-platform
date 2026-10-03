package com.wamma.support;

import org.springframework.jdbc.core.simple.JdbcClient;

import java.math.BigDecimal;
import java.sql.Types;
import java.util.UUID;

/** Datos de prueba que varias clases necesitan: vehículos con su publicación, sin repetir el SQL en cada una. */
public final class TestData {

    public record Vehicle(UUID id, String code) {
    }

    private TestData() {
    }

    /** Un vehículo en exhibición con su publicación publicada (precio en euros, con la tasa fijada). */
    public static Vehicle publishedVehicle(JdbcClient jdbc, BigDecimal priceEur) {
        Vehicle vehicle = vehicle(jdbc, "exhibicion");
        publish(jdbc, vehicle.id(), priceEur);
        return vehicle;
    }

    /** Un vehículo sin publicar, en el estado indicado. */
    public static Vehicle vehicle(JdbcClient jdbc, String state) {
        String vin = "TST" + UUID.randomUUID().toString().replace("-", "").substring(0, 14).toUpperCase();
        return jdbc.sql("""
                        insert into vehiculo (vin, marca, modelo, version, anio, color, kilometraje,
                                              carroceria, transmision, combustible, traccion, puestos, estado,
                                              sede_id, precio_adquisicion, moneda_adquisicion, tasa_bcv_adquisicion,
                                              fecha_tasa_adquisicion, es_demostracion)
                        select :vin, 'Toyota', 'Corolla', 'XLi', 2021, 'Blanco', 15000,
                               'sedan', 'automatica', 'gasolina', '4x2', 5, :state,
                               id, 12000, 'EUR', 45.0, current_date, true
                        from sede where codigo = 'DC'
                        returning id, codigo
                        """)
                .param("vin", vin)
                .param("state", state)
                .query((rs, n) -> new Vehicle(rs.getObject("id", UUID.class), rs.getString("codigo")))
                .single();
    }

    public static void publish(JdbcClient jdbc, UUID vehicleId, BigDecimal priceEur) {
        jdbc.sql("""
                        insert into publicacion (vehiculo_id, titulo, precio_venta, moneda, tasa_bcv, fecha_tasa,
                                                 estado, etiqueta, publicado_en)
                        values (:id, 'Toyota Corolla 2021', :price, 'EUR', 45.0, current_date, 'publicado',
                                'recien_ingresado', now())
                        """)
                .param("id", vehicleId, Types.OTHER)
                .param("price", priceEur)
                .update();
    }
}
