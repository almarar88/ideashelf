package ai.pacto.app.platform.location

import ai.pacto.app.domain.model.GeoPoint
import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import androidx.core.content.ContextCompat

/** Single position fix used to prove arrival at a milestone's site. */
class LocationProbe(private val context: Context) {

    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    fun requestFix(onResult: (GeoPoint?) -> Unit) {
        if (!hasPermission()) {
            onResult(null)
            return
        }
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        if (manager == null) {
            onResult(null)
            return
        }

        val cached = listOfNotNull(
            runCatching { manager.getLastKnownLocation(LocationManager.GPS_PROVIDER) }.getOrNull(),
            runCatching { manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) }.getOrNull()
        ).maxByOrNull { it.time }

        val provider = when {
            manager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> null
        }

        if (provider == null) {
            onResult(cached?.toGeoPoint())
            return
        }

        var delivered = false
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                if (delivered) return
                delivered = true
                runCatching { manager.removeUpdates(this) }
                onResult(location.toGeoPoint())
            }

            @Deprecated("Required by the pre-Q LocationListener contract")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

            override fun onProviderDisabled(provider: String) {
                if (delivered) return
                delivered = true
                runCatching { manager.removeUpdates(this) }
                onResult(cached?.toGeoPoint())
            }

            override fun onProviderEnabled(provider: String) = Unit
        }

        runCatching {
            manager.requestLocationUpdates(provider, 0L, 0f, listener)
        }.onFailure {
            onResult(cached?.toGeoPoint())
        }
    }

    private fun Location.toGeoPoint() = GeoPoint(latitude, longitude, label = null, radiusMeters = accuracy.toDouble())
}
