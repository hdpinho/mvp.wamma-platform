package com.wamma.inventory.photos;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

/**
 * El almacén de fotos no participa de la transacción de la base. Para que no queden fotos
 * sin registro ni registros sin foto (plan 005 §5):
 * <ul>
 *   <li>lo que se sube se borra si la transacción se revierte;</li>
 *   <li>lo que se quita se borra solo cuando la transacción se confirma.</li>
 * </ul>
 */
@Component
public class PhotoCleanup {

    private static final Logger log = LoggerFactory.getLogger(PhotoCleanup.class);

    private final PhotoStorage storage;

    public PhotoCleanup(PhotoStorage storage) {
        this.storage = storage;
    }

    public void deleteIfRolledBack(List<String> keys) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    deleteQuietly(keys);
                }
            }
        });
    }

    public void deleteAfterCommit(List<String> keys) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteQuietly(keys);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteQuietly(keys);
            }
        });
    }

    private void deleteQuietly(List<String> keys) {
        for (String key : keys) {
            try {
                storage.delete(key);
            } catch (RuntimeException e) {
                log.warn("No se pudo borrar la foto {} del almacén; queda huérfana", key, e);
            }
        }
    }
}
