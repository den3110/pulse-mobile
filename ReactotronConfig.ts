import Reactotron from "reactotron-react-native";
import { NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

if (__DEV__) {
  const scriptURL = NativeModules.SourceCode.scriptURL;
  // Fallback to localhost if scriptURL is null (e.g. in some debug modes)
  const scriptHostname =
    scriptURL?.split("://")[1]?.split(":")[0] || "localhost";

  Reactotron.setAsyncStorageHandler(AsyncStorage)
    .configure({
      name: "Pulse Mobile",
      host: scriptHostname,
    })
    .useReactNative({
      asyncStorage: true,
      networking: {
        ignoreUrls: /symbolicate/,
      },
      editor: false, // there are more options like overlay, etc.
      overlay: false, // if you want to use the overlay features
    })
    .connect();

  // Clear every time app reloads
  Reactotron.clear?.();

  console.log("Reactotron Configured on host:", scriptHostname);
}
