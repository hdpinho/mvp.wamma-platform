package com.wamma.inventory;

import com.wamma.inventory.InventoryViews.InventoryVehicle;
import com.wamma.inventory.InventoryViews.PhotoView;
import com.wamma.platform.web.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/** Inventario del backoffice (plan 005 §6). Cada endpoint exige su permiso (plan 001 §9). */
@RestController
public class InventoryController {

    private final InventoryService inventory;
    private final PhotoService photos;

    public InventoryController(InventoryService inventory, PhotoService photos) {
        this.inventory = inventory;
        this.photos = photos;
    }

    public record AvailabilityRequest(
            @NotBlank(message = "Indica la disponibilidad") String disponibilidad,
            @Size(max = 300, message = "El motivo tiene a lo sumo 300 caracteres") String motivo) {
    }

    public record ReorderRequest(@NotEmpty(message = "Indica el orden de las fotos") List<UUID> fotos) {
    }

    @GetMapping("/v1/inventario")
    @PreAuthorize("hasAuthority('inventario.ver')")
    public List<InventoryVehicle> list() {
        return inventory.list();
    }

    @GetMapping("/v1/inventario/{codigo}")
    @PreAuthorize("hasAuthority('inventario.ver')")
    public InventoryVehicle get(@PathVariable String codigo) {
        return inventory.get(codigo);
    }

    @PostMapping("/v1/inventario")
    @PreAuthorize("hasAuthority('inventario.gestionar')")
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryVehicle create(@Valid @RequestBody VehicleInput input) {
        return inventory.create(input);
    }

    @PutMapping("/v1/inventario/{codigo}")
    @PreAuthorize("hasAuthority('inventario.gestionar')")
    public InventoryVehicle update(@PathVariable String codigo, @Valid @RequestBody VehicleInput input) {
        return inventory.update(codigo, input);
    }

    @DeleteMapping("/v1/inventario/{codigo}")
    @PreAuthorize("hasAuthority('inventario.gestionar')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String codigo) {
        inventory.delete(codigo);
    }

    @PostMapping(value = "/v1/inventario/{codigo}/fotos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('inventario.gestionar')")
    @ResponseStatus(HttpStatus.CREATED)
    public PhotoView addPhoto(@PathVariable String codigo, @RequestParam("archivo") MultipartFile archivo) throws IOException {
        requireValidCode(codigo);
        return photos.add(codigo, archivo.getBytes());
    }

    @DeleteMapping("/v1/inventario/{codigo}/fotos/{id}")
    @PreAuthorize("hasAuthority('inventario.gestionar')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removePhoto(@PathVariable String codigo, @PathVariable UUID id) {
        requireValidCode(codigo);
        photos.remove(codigo, id);
    }

    @PutMapping("/v1/inventario/{codigo}/fotos/orden")
    @PreAuthorize("hasAuthority('inventario.gestionar')")
    public List<PhotoView> reorderPhotos(@PathVariable String codigo, @Valid @RequestBody ReorderRequest request) {
        requireValidCode(codigo);
        return photos.reorder(codigo, request.fotos());
    }

    @PostMapping("/v1/inventario/{codigo}/publicacion")
    @PreAuthorize("hasAuthority('inventario.gestionar')")
    public InventoryVehicle publish(@PathVariable String codigo) {
        return inventory.publish(codigo);
    }

    @DeleteMapping("/v1/inventario/{codigo}/publicacion")
    @PreAuthorize("hasAuthority('inventario.gestionar')")
    public InventoryVehicle pause(@PathVariable String codigo) {
        return inventory.pause(codigo);
    }

    @PostMapping("/v1/inventario/publicacion-en-lote")
    @PreAuthorize("hasAuthority('inventario.gestionar')")
    public InventoryService.BatchResult publishReady() {
        return inventory.publishReady();
    }

    @PutMapping("/v1/inventario/{codigo}/disponibilidad")
    @PreAuthorize("hasAnyAuthority('inventario.gestionar', 'crm.operar')")
    public InventoryVehicle changeAvailability(@PathVariable String codigo, @Valid @RequestBody AvailabilityRequest request) {
        return inventory.changeAvailability(codigo, request.disponibilidad(), request.motivo());
    }

    private static void requireValidCode(String codigo) {
        if (!InventoryCode.isValid(codigo)) {
            throw ApiException.notFound("El vehículo no existe.");
        }
    }
}
