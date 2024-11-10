import axios from "axios";
import colors from "colors";

class Server {
  constructor() {}

  async getData(lang) {
    try {
      const endpointDatabase =
        "https://raw.githubusercontent.com/DuyAnh4091/blum/refs/heads/main/blum.json";
      const { data } = await axios.get(endpointDatabase);
      return data;
    } catch (error) {
      console.log(colors.red(lang?.server?.get_json_github_error));
      return null;
    }
  }

  async showNoti(lang) {
    const database = await this.getData();
    if (database && database.noti) {
      console.log(colors.blue("📢 " + lang?.server?.noti));
      console.log(database.noti);
      console.log("");
    }
  }
}

const server = new Server();
export default server;
