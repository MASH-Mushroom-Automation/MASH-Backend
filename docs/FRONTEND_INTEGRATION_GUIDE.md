# 📱 Frontend Integration Guide - OAuth Implementation

## 📋 Overview

This guide provides complete, production-ready code examples for integrating **Google OAuth 2.0** and **Facebook Login** into your MASH frontend applications (mobile apps and web portal).

---

## 📱 Mobile Integration (React Native)

### Prerequisites

```bash
# Install React Native OAuth packages
npm install @react-native-google-signin/google-signin
npm install react-native-fbsdk-next
npm install @react-native-async-storage/async-storage
npm install axios

# iOS: Install CocoaPods
cd ios && pod install && cd ..
```

### Google Sign-In (React Native)

#### 1. Configuration

**Android Configuration** (`android/app/src/main/res/values/strings.xml`):
```xml
<resources>
    <string name="app_name">MASH</string>
    <!-- Add your Google Web Client ID -->
    <string name="default_web_client_id">123456789-abcdefghijklmnop.apps.googleusercontent.com</string>
</resources>
```

**iOS Configuration** (`ios/MASH/Info.plist`):
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <!-- Add your REVERSED iOS Client ID -->
      <string>com.googleusercontent.apps.123456789-ios</string>
    </array>
  </dict>
</array>

<!-- Add your iOS Client ID -->
<key>GIDClientID</key>
<string>123456789-ios.apps.googleusercontent.com</string>
```

#### 2. Google Sign-In Implementation

**Full Implementation** (`src/services/GoogleAuthService.ts`):
```typescript
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

/**
 * Google Authentication Service
 * Handles Google Sign-In and backend authentication
 */
class GoogleAuthService {
  private apiUrl = 'https://api.mash.com/api/v1'; // Change to your backend URL

  /**
   * Configure Google Sign-In
   * Call this once when app starts (e.g., in App.tsx)
   */
  configure() {
    GoogleSignin.configure({
      webClientId: '123456789-abcdefghijklmnop.apps.googleusercontent.com', // From Google Cloud Console
      offlineAccess: true, // Get refresh token
      hostedDomain: '', // Optional: restrict to specific domain
      forceCodeForRefreshToken: true, // Force refresh token on Android
      accountName: '', // Optional: pre-select account
      iosClientId: '123456789-ios.apps.googleusercontent.com', // From Google Cloud Console (iOS)
    });
  }

  /**
   * Sign in with Google
   * Returns user data and JWT tokens from backend
   */
  async signIn(): Promise<{
    success: boolean;
    user?: any;
    accessToken?: string;
    refreshToken?: string;
    isNewUser?: boolean;
    error?: string;
  }> {
    try {
      // Step 1: Check if Google Play Services are available
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      // Step 2: Sign in with Google (opens native UI)
      const userInfo = await GoogleSignin.signIn();

      console.log('Google Sign-In successful:', userInfo.user.email);

      // Step 3: Get ID token (JWT)
      const idToken = userInfo.idToken;

      if (!idToken) {
        throw new Error('Failed to get Google ID token');
      }

      // Step 4: Send ID token to backend
      const response = await axios.post(
        `${this.apiUrl}/auth/google/login`,
        {
          idToken,
          deviceInfo: {
            deviceId: await DeviceInfo.getUniqueId(),
            platform: Platform.OS,
            appVersion: DeviceInfo.getVersion(),
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data;

      if (data.success) {
        // Step 5: Store JWT tokens
        await AsyncStorage.setItem('accessToken', data.accessToken);
        await AsyncStorage.setItem('refreshToken', data.refreshToken);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));

        console.log('Backend authentication successful');

        return {
          success: true,
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          isNewUser: data.isNewUser,
        };
      } else {
        throw new Error(data.message || 'Backend authentication failed');
      }
    } catch (error: any) {
      console.error('Google Sign-In error:', error);

      // Handle specific error codes
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { success: false, error: 'User cancelled the login' };
      } else if (error.code === statusCodes.IN_PROGRESS) {
        return { success: false, error: 'Sign in already in progress' };
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { success: false, error: 'Google Play Services not available' };
      } else {
        return {
          success: false,
          error: error.response?.data?.message || error.message || 'Failed to sign in with Google',
        };
      }
    }
  }

  /**
   * Sign out from Google
   */
  async signOut() {
    try {
      await GoogleSignin.signOut();
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('user');
      console.log('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  /**
   * Check if user is currently signed in
   */
  async isSignedIn(): Promise<boolean> {
    const isSignedIn = await GoogleSignin.isSignedIn();
    const hasToken = !!(await AsyncStorage.getItem('accessToken'));
    return isSignedIn && hasToken;
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    try {
      const userInfo = await GoogleSignin.signInSilently();
      return userInfo;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }
}

export default new GoogleAuthService();
```

#### 3. Login Screen Component

**Complete Login Screen** (`src/screens/LoginScreen.tsx`):
```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import GoogleAuthService from '../services/GoogleAuthService';
import { useNavigation } from '@react-navigation/native';

const LoginScreen = () => {
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    // Configure Google Sign-In on mount
    GoogleAuthService.configure();

    // Check if already signed in
    checkSignInStatus();
  }, []);

  const checkSignInStatus = async () => {
    const isSignedIn = await GoogleAuthService.isSignedIn();
    if (isSignedIn) {
      // Already signed in, navigate to home
      navigation.navigate('Home');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);

    const result = await GoogleAuthService.signIn();

    setLoading(false);

    if (result.success) {
      // Success - navigate to home
      if (result.isNewUser) {
        Alert.alert(
          'Welcome!',
          `Your account has been created successfully. Welcome, ${result.user.firstName}!`,
          [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
        );
      } else {
        navigation.navigate('Home');
      }
    } else {
      // Error - show alert
      Alert.alert('Login Failed', result.error || 'Failed to sign in with Google');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image source={require('../assets/logo.png')} style={styles.logo} />
        <Text style={styles.title}>Welcome to MASH</Text>
        <Text style={styles.subtitle}>Mushroom Automation System</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Image
                source={require('../assets/google-logo.png')}
                style={styles.googleLogo}
              />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.emailButton}
          onPress={() => navigation.navigate('EmailLogin')}
        >
          <Text style={styles.emailButtonText}>Sign in with Email</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footerText}>
        By continuing, you agree to our Terms of Service and Privacy Policy
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  buttonContainer: {
    marginBottom: 30,
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleLogo: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emailButton: {
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  emailButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default LoginScreen;
```

---

### Facebook Login (React Native)

#### 1. Configuration

**Android Configuration** (`android/app/src/main/res/values/strings.xml`):
```xml
<resources>
    <string name="app_name">MASH</string>
    <string name="facebook_app_id">1234567890123456</string>
    <string name="fb_login_protocol_scheme">fb1234567890123456</string>
    <string name="facebook_client_token">your-facebook-client-token</string>
</resources>
```

**Android Manifest** (`android/app/src/main/AndroidManifest.xml`):
```xml
<application>
    <!-- Add Facebook SDK initialization -->
    <meta-data
        android:name="com.facebook.sdk.ApplicationId"
        android:value="@string/facebook_app_id"/>
    
    <meta-data
        android:name="com.facebook.sdk.ClientToken"
        android:value="@string/facebook_client_token"/>
    
    <activity
        android:name="com.facebook.FacebookActivity"
        android:configChanges="keyboard|keyboardHidden|screenLayout|screenSize|orientation"
        android:label="@string/app_name" />
    
    <activity
        android:name="com.facebook.CustomTabActivity"
        android:exported="true">
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="@string/fb_login_protocol_scheme" />
        </intent-filter>
    </activity>
</application>
```

**iOS Configuration** (`ios/MASH/Info.plist`):
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>fb1234567890123456</string>
    </array>
  </dict>
</array>

<key>FacebookAppID</key>
<string>1234567890123456</string>
<key>FacebookClientToken</key>
<string>your-facebook-client-token</string>
<key>FacebookDisplayName</key>
<string>MASH</string>

<key>LSApplicationQueriesSchemes</key>
<array>
  <string>fbapi</string>
  <string>fb-messenger-share-api</string>
</array>
```

#### 2. Facebook Login Implementation

**Facebook Auth Service** (`src/services/FacebookAuthService.ts`):
```typescript
import { LoginManager, AccessToken, GraphRequest, GraphRequestManager } from 'react-native-fbsdk-next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

class FacebookAuthService {
  private apiUrl = 'https://api.mash.com/api/v1';

  /**
   * Sign in with Facebook
   */
  async signIn(): Promise<{
    success: boolean;
    user?: any;
    accessToken?: string;
    refreshToken?: string;
    isNewUser?: boolean;
    error?: string;
  }> {
    try {
      // Step 1: Login with Facebook (opens native UI)
      const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);

      if (result.isCancelled) {
        return { success: false, error: 'User cancelled Facebook login' };
      }

      console.log('Facebook login successful');

      // Step 2: Get access token
      const data = await AccessToken.getCurrentAccessToken();

      if (!data) {
        throw new Error('Failed to get Facebook access token');
      }

      const accessToken = data.accessToken.toString();

      // Step 3: Send access token to backend
      const response = await axios.post(
        `${this.apiUrl}/auth/facebook/login`,
        {
          accessToken,
          deviceInfo: {
            deviceId: await DeviceInfo.getUniqueId(),
            platform: Platform.OS,
            appVersion: DeviceInfo.getVersion(),
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const responseData = response.data;

      if (responseData.success) {
        // Step 4: Store JWT tokens
        await AsyncStorage.setItem('accessToken', responseData.accessToken);
        await AsyncStorage.setItem('refreshToken', responseData.refreshToken);
        await AsyncStorage.setItem('user', JSON.stringify(responseData.user));

        console.log('Backend authentication successful');

        return {
          success: true,
          user: responseData.user,
          accessToken: responseData.accessToken,
          refreshToken: responseData.refreshToken,
          isNewUser: responseData.isNewUser,
        };
      } else {
        throw new Error(responseData.message || 'Backend authentication failed');
      }
    } catch (error: any) {
      console.error('Facebook login error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to sign in with Facebook',
      };
    }
  }

  /**
   * Sign out from Facebook
   */
  async signOut() {
    try {
      await LoginManager.logOut();
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('user');
      console.log('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  /**
   * Get user profile from Facebook
   */
  async getUserProfile(): Promise<any> {
    return new Promise((resolve, reject) => {
      const infoRequest = new GraphRequest(
        '/me',
        {
          parameters: {
            fields: {
              string: 'id,name,first_name,last_name,email,picture.type(large)',
            },
          },
        },
        (error, result) => {
          if (error) {
            console.error('Error fetching user profile:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      new GraphRequestManager().addRequest(infoRequest).start();
    });
  }
}

export default new FacebookAuthService();
```

#### 3. Update Login Screen with Facebook

**Add Facebook Button** (`src/screens/LoginScreen.tsx`):
```typescript
import FacebookAuthService from '../services/FacebookAuthService';

// Inside LoginScreen component, add this method:
const handleFacebookSignIn = async () => {
  setLoading(true);

  const result = await FacebookAuthService.signIn();

  setLoading(false);

  if (result.success) {
    if (result.isNewUser) {
      Alert.alert(
        'Welcome!',
        `Your account has been created successfully!`,
        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
      );
    } else {
      navigation.navigate('Home');
    }
  } else {
    Alert.alert('Login Failed', result.error || 'Failed to sign in with Facebook');
  }
};

// Add this button to your JSX:
<TouchableOpacity
  style={styles.facebookButton}
  onPress={handleFacebookSignIn}
  disabled={loading}
>
  {loading ? (
    <ActivityIndicator color="#fff" />
  ) : (
    <>
      <Image
        source={require('../assets/facebook-logo.png')}
        style={styles.facebookLogo}
      />
      <Text style={styles.facebookButtonText}>Continue with Facebook</Text>
    </>
  )}
</TouchableOpacity>

// Add styles:
facebookButton: {
  flexDirection: 'row',
  backgroundColor: '#1877F2',
  paddingVertical: 16,
  paddingHorizontal: 24,
  borderRadius: 8,
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
},
facebookLogo: {
  width: 24,
  height: 24,
  marginRight: 12,
},
facebookButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},
```

---

## 🌐 Web Integration (React)

### Prerequisites

```bash
# Install React OAuth packages
npm install @react-oauth/google
npm install react-facebook-login
npm install axios
```

### Google Sign-In (React Web)

#### 1. Setup GoogleOAuthProvider

**App Entry Point** (`src/App.tsx`):
```typescript
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';

function App() {
  const googleClientId = '123456789-abcdefghijklmnop.apps.googleusercontent.com';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/home" element={<HomePage />} />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
```

#### 2. Login Page with Google Button

**Login Page** (`src/pages/LoginPage.tsx`):
```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import axios from 'axios';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setLoading(true);
    setError(null);

    try {
      const idToken = credentialResponse.credential;

      if (!idToken) {
        throw new Error('No credential returned from Google');
      }

      // Send ID token to backend
      const response = await axios.post(
        'https://api.mash.com/api/v1/auth/google/login',
        {
          idToken,
          deviceInfo: {
            platform: 'web',
            appVersion: '1.0.0',
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data;

      if (data.success) {
        // Store tokens in localStorage
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Redirect to home page
        navigate('/home');

        if (data.isNewUser) {
          alert(`Welcome, ${data.user.firstName}! Your account has been created.`);
        }
      } else {
        throw new Error(data.message || 'Backend authentication failed');
      }
    } catch (err: any) {
      console.error('Google login error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    console.error('Google login failed');
    setError('Google login failed. Please try again.');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <img src="/logo.png" alt="MASH Logo" className="logo" />
          <h1>Welcome to MASH</h1>
          <p>Mushroom Automation System</p>
        </div>

        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        <div className="login-buttons">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap
            theme="outline"
            size="large"
            text="continue_with"
            shape="rectangular"
            logo_alignment="left"
          />

          <button className="email-button" onClick={() => navigate('/email-login')}>
            Sign in with Email
          </button>
        </div>

        <p className="footer-text">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
```

#### 3. Styling

**Login Page Styles** (`src/pages/LoginPage.css`):
```css
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-container {
  background: white;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  width: 80px;
  height: 80px;
  margin-bottom: 16px;
}

.login-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin-bottom: 8px;
}

.login-header p {
  font-size: 16px;
  color: #666;
}

.error-message {
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 20px;
}

.error-message p {
  color: #c33;
  margin: 0;
  font-size: 14px;
}

.login-buttons {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.email-button {
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  color: #333;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.email-button:hover {
  background-color: #f5f5f5;
  border-color: #ccc;
}

.footer-text {
  font-size: 12px;
  color: #999;
  text-align: center;
  line-height: 1.5;
}
```

---

### Facebook Login (React Web)

#### 1. Install Facebook Login Package

```bash
npm install react-facebook-login
```

#### 2. Add Facebook Login to Login Page

**Update Login Page** (`src/pages/LoginPage.tsx`):
```typescript
import FacebookLogin from 'react-facebook-login';

// Inside LoginPage component:
const handleFacebookResponse = async (response: any) => {
  if (response.status === 'unknown') {
    console.error('User cancelled login or did not fully authorize.');
    setError('Facebook login was cancelled');
    return;
  }

  setLoading(true);
  setError(null);

  try {
    const accessToken = response.accessToken;

    // Send access token to backend
    const result = await axios.post(
      'https://api.mash.com/api/v1/auth/facebook/login',
      {
        accessToken,
        deviceInfo: {
          platform: 'web',
          appVersion: '1.0.0',
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = result.data;

    if (data.success) {
      // Store tokens
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect to home
      navigate('/home');

      if (data.isNewUser) {
        alert(`Welcome, ${data.user.firstName}!`);
      }
    } else {
      throw new Error(data.message || 'Backend authentication failed');
    }
  } catch (err: any) {
    console.error('Facebook login error:', err);
    setError(err.response?.data?.message || err.message || 'Failed to sign in with Facebook');
  } finally {
    setLoading(false);
  }
};

// Add to JSX:
<FacebookLogin
  appId="1234567890123456"
  autoLoad={false}
  fields="name,email,picture"
  callback={handleFacebookResponse}
  cssClass="facebook-button"
  icon="fa-facebook"
  textButton="Continue with Facebook"
/>
```

#### 3. Facebook Button Styling

**Add to LoginPage.css**:
```css
.facebook-button {
  width: 100%;
  padding: 16px;
  background-color: #1877F2;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background-color 0.2s;
}

.facebook-button:hover {
  background-color: #166FE5;
}

.facebook-button svg {
  width: 20px;
  height: 20px;
}
```

---

## 🔗 Account Linking (Mobile & Web)

### Link Google Account (After Login)

**Account Settings Page** (`src/pages/AccountSettings.tsx`):
```typescript
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AccountSettings: React.FC = () => {
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOAuthStatus();
  }, []);

  const fetchOAuthStatus = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');

      const response = await axios.get(
        'https://api.mash.com/api/v1/auth/social/status',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        setLinkedProviders(response.data.linkedProviders);
      }
    } catch (error) {
      console.error('Failed to fetch OAuth status:', error);
    }
  };

  const handleLinkGoogle = async (idToken: string) => {
    setLoading(true);

    try {
      const accessToken = localStorage.getItem('accessToken');

      const response = await axios.post(
        'https://api.mash.com/api/v1/auth/social/link/google',
        { idToken },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        alert('Google account linked successfully!');
        fetchOAuthStatus(); // Refresh status
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to link Google account');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!confirm('Are you sure you want to unlink your Google account?')) {
      return;
    }

    setLoading(true);

    try {
      const accessToken = localStorage.getItem('accessToken');

      const response = await axios.delete(
        'https://api.mash.com/api/v1/auth/social/unlink/google',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.data.success) {
        alert('Google account unlinked successfully');
        fetchOAuthStatus();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to unlink Google account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-settings">
      <h2>Linked Accounts</h2>

      <div className="linked-account">
        <div className="account-info">
          <img src="/google-logo.png" alt="Google" />
          <span>Google</span>
        </div>

        {linkedProviders.includes('google') ? (
          <button onClick={handleUnlinkGoogle} disabled={loading}>
            Unlink
          </button>
        ) : (
          <GoogleLogin
            onSuccess={(response) => handleLinkGoogle(response.credential!)}
            onError={() => alert('Failed to link Google account')}
            text="signin_with"
          />
        )}
      </div>

      <div className="linked-account">
        <div className="account-info">
          <img src="/facebook-logo.png" alt="Facebook" />
          <span>Facebook</span>
        </div>

        {linkedProviders.includes('facebook') ? (
          <button onClick={() => {/* Similar to Google */}} disabled={loading}>
            Unlink
          </button>
        ) : (
          <button onClick={() => {/* Link Facebook */}}>
            Link Facebook
          </button>
        )}
      </div>
    </div>
  );
};

export default AccountSettings;
```

---

## 🧪 Testing Your Integration

### Manual Testing Checklist

**Mobile App (React Native)**:
- [ ] Google Sign-In button appears
- [ ] Tapping Google button opens Google account selector
- [ ] Selecting Google account returns to app
- [ ] Backend receives ID token and returns JWT tokens
- [ ] User is navigated to Home screen
- [ ] New users see welcome message
- [ ] Facebook Sign-In button appears and works
- [ ] Logout clears stored tokens

**Web Portal (React)**:
- [ ] Google Sign-In button appears
- [ ] Clicking Google button opens popup/redirect
- [ ] After Google authentication, user returns to app
- [ ] Backend receives ID token and returns JWT tokens
- [ ] User is redirected to /home
- [ ] Facebook Login button appears and works
- [ ] Tokens stored in localStorage
- [ ] Logout clears tokens

**Error Handling**:
- [ ] Invalid token shows error message
- [ ] Network errors handled gracefully
- [ ] User cancellation handled properly
- [ ] Duplicate account error shown
- [ ] Rate limiting message displayed

---

## 🚨 Troubleshooting

### Common Issues

**Issue 1: "Google Sign-In failed with error: DEVELOPER_ERROR" (Android)**

**Solution**:
- Verify SHA-1 fingerprint in Google Cloud Console matches your keystore
- Check `default_web_client_id` in `strings.xml`
- Ensure Google Play Services is installed on device

**Issue 2: "Error getting access token" (Facebook iOS)**

**Solution**:
- Verify `FacebookAppID` in `Info.plist` is correct
- Check URL scheme: `fb{APP_ID}`
- Rebuild the app after configuration changes

**Issue 3: "Network request failed"**

**Solution**:
- Check backend URL is correct
- Verify backend is running
- Check network connectivity
- Verify CORS is configured on backend

---

**Document Version**: 1.0  
**Last Updated**: November 12, 2025  
**Status**: ✅ Ready for Integration
