/** Shared document `type` values for customer document uploads (client + server safe). */

export const CUSTOMER_COLLATERAL_IMAGE_DOCUMENT_TYPE = "collateral_image";
export const CUSTOMER_HOME_LOCATION_PHOTO_DOCUMENT_TYPE = "home_location_photo";
export const CUSTOMER_BUSINESS_LOCATION_PHOTO_DOCUMENT_TYPE = "business_location_photo";
export const CUSTOMER_SUPPORTING_DOCUMENT_TYPE = "supporting_document";
export const CUSTOMER_GUARANTOR_PHOTO_DOCUMENT_TYPE = "guarantor_photo";
export const CUSTOMER_GUARANTOR_PASSPORT_PHOTO_DOCUMENT_TYPE = "guarantor_passport_photo";
export const CUSTOMER_GUARANTOR_COLLATERAL_PHOTO_DOCUMENT_TYPE = "guarantor_collateral_photo";
/**
 * Ward letters are stored as `guarantor_document` (backend has no dedicated ward-letter type).
 * Uploads use a "Ward letter" name so the edit form can re-attach them to the Ward letter field.
 */
export const CUSTOMER_GUARANTOR_WARD_LETTER_DOCUMENT_TYPE = "guarantor_document";
export const CUSTOMER_GUARANTOR_WARD_LETTER_UPLOAD_NAME = "Ward letter";
export const CUSTOMER_GUARANTOR_DOCUMENT_TYPE = "guarantor_document";

/** @deprecated Prefer guarantor_document / guarantor_photo types. */
export const CUSTOMER_GUARANTOR_ID_FRONT_DOCUMENT_TYPE = "guarantor_id_front";
/** @deprecated Prefer guarantor_document / guarantor_photo types. */
export const CUSTOMER_GUARANTOR_ID_BACK_DOCUMENT_TYPE = "guarantor_id_back";
