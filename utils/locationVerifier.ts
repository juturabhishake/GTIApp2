import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

export async function clearSessionAndKickToLogin(error?: string, locations?: string) {
  try {
    await Promise.allSettled([
      SecureStore.deleteItemAsync('employee_id'),
      SecureStore.deleteItemAsync('full_name'),
      SecureStore.deleteItemAsync('password'),
      SecureStore.deleteItemAsync('user_id'),
      SecureStore.deleteItemAsync('department'),
      SecureStore.deleteItemAsync('position'),
      SecureStore.deleteItemAsync('section'),
      SecureStore.deleteItemAsync('logintype'),
      SecureStore.deleteItemAsync('tped'),
      SecureStore.deleteItemAsync('sop'),
      SecureStore.deleteItemAsync('ces'),
      SecureStore.deleteItemAsync('tl'),
      SecureStore.deleteItemAsync('currentgeocord'),
      SecureStore.deleteItemAsync('current_latitude'),
      SecureStore.deleteItemAsync('current_longitude'),
    ]);
  } catch (e) {
    console.error(e);
  }
  if (error) {
    router.replace({ pathname: '/', params: { error, locations: locations || '' } });
  } else {
    router.replace('/');
  }
}

export async function verifyLocationForScreen(
  targetPath: string,
  onKickToLogin?: (error?: string, locations?: string) => Promise<void> | void,
): Promise<boolean> {
  if (targetPath === '/') return false;

  const handleKick = async (error?: string, locations?: string) => {
    if (onKickToLogin) {
      await onKickToLogin(error, locations);
    } else {
      await clearSessionAndKickToLogin(error, locations);
    }
  };

  try {
    const [savedEmpId, savedPassword] = await Promise.all([
      SecureStore.getItemAsync('employee_id'),
      SecureStore.getItemAsync('password'),
    ]);

    if (!savedEmpId || !savedPassword) {
      console.log('Background verification failed: Missing saved credentials');
      await handleKick();
      return false;
    }

    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== 'granted') {
        console.log('Background verification failed: Location permission denied');
        await handleKick('Location Permission Required');
        return false;
      }
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      console.log('Background verification failed: GPS / Location services disabled');
      await handleKick('GPS / Location Disabled');
      return false;
    }

    let location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    if (!location) {
      location = await Location.getLastKnownPositionAsync({});
    }
    if (!location) {
      location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
    }

    if (!location) {
      console.log('Background verification error: Unable to determine location fix');
      return false;
    }

    const latitude = location.coords.latitude;
    const longitude = location.coords.longitude;
    console.log(`Checking location for screen "${targetPath}": Coordinates (${latitude}, ${longitude})`);

    await SecureStore.setItemAsync('current_latitude', String(latitude));
    await SecureStore.setItemAsync('current_longitude', String(longitude));

    const response = await fetch('https://gtiappsbackend.vercel.app/api/geologin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeId: savedEmpId,
        password: savedPassword,
        latitude,
        longitude,
      }),
    });

    const data = await response.json();

    if (response.status === 403 || data.message === 'Location Restricted') {
      console.log('Location check status: ERROR - Location Restricted', {
        latitude,
        longitude,
        allowedLocations: data.allowedLocations,
      });
      const rawLocations = typeof data.allowedLocations === 'string' ? data.allowedLocations : '';
      await handleKick('Location Restricted', rawLocations);
      return false;
    }

    if (response.status === 401 || data.message === 'Invalid Credentials') {
      console.log('Location check status: ERROR - Invalid Credentials', { employeeId: savedEmpId });
      await handleKick('Invalid Credentials');
      return false;
    }

    if (response.ok && data.message === 'Login Success') {
      console.log('Location check status: SUCCESS', {
        latitude,
        longitude,
        address: data.data?.currentgeocord || data.data?.GeoAddress,
      });
      const toStr = (val: unknown) => (val === null || val === undefined ? '' : String(val));
      const geoAddr = toStr(data.data?.currentgeocord || data.data?.GeoAddress || data.data?.Address || data.data?.MatchedAddress);
      if (geoAddr) {
        await SecureStore.setItemAsync('currentgeocord', geoAddr);
      }
      if (data.data && typeof data.data === 'object') {
        const uName = toStr(data.data.Username);
        const dept = toStr(data.data.Department);
        const pos = toStr(data.data.Position);
        const sec = toStr(data.data.Section);
        const lType = toStr(data.data.logintype);
        if (uName) await SecureStore.setItemAsync('full_name', uName);
        if (dept) {
          await SecureStore.setItemAsync('department', dept);
          await SecureStore.setItemAsync('tped', dept);
        }
        if (pos) {
          await SecureStore.setItemAsync('position', pos);
          await SecureStore.setItemAsync('sop', pos);
        }
        if (sec) {
          await SecureStore.setItemAsync('section', sec);
          await SecureStore.setItemAsync('ces', sec);
        }
        if (lType) {
          await SecureStore.setItemAsync('logintype', lType);
          await SecureStore.setItemAsync('tl', lType);
        }
      }
      return true;
    }

    console.log('Location check status: ERROR -', data.message || 'Verification Failed');
    await handleKick(data.message || 'Verification Failed');
    return false;
  } catch (err) {
    console.log('Background verification network/system error:', err);
    return false;
  }
}

