package ai.pacto.app.domain

import ai.pacto.app.domain.engine.GeoFenceEvaluator
import ai.pacto.app.domain.model.GeoPoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GeoFenceTest {

    private val site = GeoPoint(24.7136, 46.6753, "الموقع", radiusMeters = 150.0)

    @Test
    fun `the same point is zero metres away`() {
        assertEquals(0.0, GeoFenceEvaluator.distanceMeters(site, site), 0.001)
    }

    @Test
    fun `a point just inside the radius counts as arrival`() {
        // Roughly 100 m north of the site.
        val nearby = GeoPoint(24.7145, 46.6753)
        assertTrue(GeoFenceEvaluator.distanceMeters(site, nearby) < 150)
        assertTrue(GeoFenceEvaluator.isInside(site, nearby))
    }

    @Test
    fun `a point across town does not`() {
        val far = GeoPoint(24.8000, 46.7500)
        assertFalse(GeoFenceEvaluator.isInside(site, far))
    }

    @Test
    fun `one degree of latitude is about 111 kilometres`() {
        val north = GeoPoint(25.7136, 46.6753)
        val distance = GeoFenceEvaluator.distanceMeters(site, north)
        assertEquals(111_000.0, distance, 1_000.0)
    }
}
