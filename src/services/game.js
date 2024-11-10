import axios from "axios";
import colors from "colors";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import delayHelper from "../helpers/delay.js";
import generatorHelper from "../helpers/generator.js";
import authService from "./auth.js";
import { Blum } from './blum_worker.js';

dayjs.extend(utc);
dayjs.extend(timezone);

class GameService {
  constructor() {
    this.initializeBlum();
  }

  async initializeBlum() {
    await Blum.init();
  }

  async playGame(user, lang, delay) {
    try {
      const { data } = await user.http.post(5, "game/play", {});

      if (data) {
        user.log.log(
          `${lang?.game?.start_game_msg}: ${colors.blue(delay + "s")}`
        );
        return data.gameId;
      } else {
        throw new Error(`${lang?.game?.start_game_failed}: ${data.message}`);
      }
    } catch (error) {
      if (error.response?.data?.message === "not enough play passes") {
        return 2;
      } else {
        user.log.logError(
          `${lang?.game?.start_game_failed}: ${error.response?.data?.message}`
        );
      }
      return null;
    }
  }

  async claimGame(user, lang, gameId, payload) {
    const body = { payload };
    try {
      const { data } = await user.http.post(5, "game/claim", body);
      if (data) {
        user.log.log(
          `${lang?.game?.claim_success}: ${colors.green(
            payload.BP.amount + user.currency
          )}`
        );
        return true;
      } else {
        throw new Error(`${lang?.game?.claim_failed}: ${data.message}`);
      }
    } catch (error) {
      user.log.logError(
        `${lang?.game?.claim_failed}: ${error.response?.data?.message}`
      );
      return false;
    }
  }

  async eligibilityDogs(user) {
    try {
      const { data } = await user.http.get(5, "game/eligibility/dogs_drop");
      return data.eligible;
    } catch (error) {
      return false;
    }
  }

  async handleGame(user, lang, playPasses, timePlayGame) {
    const isInTimeRange = this.checkTimePlayGame(timePlayGame);
    if (isInTimeRange) {
      const profile = await authService.getProfile(user, lang);
      if (profile) playPasses = profile?.playPasses;
      const eligibleDogs = await this.eligibilityDogs(user);
      let gameCount = playPasses || 0;
      let errorCount = 0;

      while (gameCount > 0) {
        if (errorCount > 3) {
          gameCount = 0;
          continue;
        }

        await delayHelper.delay(2);
        const delay = 30 + generatorHelper.randomInt(5, 10);
        const gameId = await this.playGame(user, lang, delay);
        if (gameId === 2) {
          gameCount = 0;
          continue;
        }
        if (gameId) {
          errorCount = 0;

          // Lấy challenge từ Blum
          const challenge = await Blum.getChallenge(gameId);
          const uuidChallenge = Blum.getUUID();

          // Tạo payload
          const payload = await Blum.getPayload(
            gameId,
            {
              id: uuidChallenge,
              nonce: challenge.nonce,
              hash: challenge.hash,
            },
            {
              BP: {
                amount: generatorHelper.randomInt(150, 190), // Hoặc một giá trị khác nếu cần
              }
            },
            {
              CLOVER: {
                clicks: 0 // Điều chỉnh nếu cần
              },
              FREEZE: {
                clicks: 0 // Điều chỉnh nếu cần
              },
              BOMB: {
                clicks: 0 // Điều chỉnh nếu cần
              }
            }
          );

          // Gọi claimGame với payload đã tạo
          const statusClaim = await this.claimGame(user, lang, gameId, payload);
          if (!statusClaim) {
            errorCount++;
          }
          if (statusClaim) gameCount--;
        } else {
            errorCount++;
          }
      }
    }
  }

  async eligibilityDogs(user) {
    try {
      const { data } = await user.http.get(5, "game/eligibility/dogs_drop");
      return data.eligible;
    } catch (error) {
      return false;
    }
  }

  checkTimePlayGame(time) {
    // Lấy giờ hiện tại theo múi giờ Việt Nam (UTC+7)
    const nowHour = dayjs().hour();
    return !time.includes(nowHour);
  }

  getMinutesUntilNextStart(times) {
    // Lấy giờ hiện tại theo múi giờ Việt Nam (UTC+7)
    const currentHour = dayjs().hour();
    times.sort((a, b) => a - b);

    let nextHour = currentHour + 1;

    while (times.includes(nextHour)) {
      nextHour++;
    }

    const now = dayjs();

    const nextStartTime = now
      .set("hour", nextHour)
      .set("minute", 0)
      .set("second", 0);

    // Tính số phút từ giờ hiện tại đến lần bắt đầu tiếp theo
    return nextStartTime.diff(now, "minute");
  }

  async handleGame(user, lang, playPasses, timePlayGame) {
    const isInTimeRange = this.checkTimePlayGame(timePlayGame);
    if (isInTimeRange) {
      const profile = await authService.getProfile(user, lang);
      if (profile) playPasses = profile?.playPasses;
      const eligibleDogs = await this.eligibilityDogs(user);
      const textDropDogs =
        (eligibleDogs ? lang?.game?.can : lang?.game?.notcan) +
        ` ${lang?.game?.claim_dogs} 🦴`;
      const msg = lang?.game?.game_remaining.replace(
        "XXX",
        colors.blue(playPasses)
      );
      user.log.log(`${msg} ${colors.magenta(`[${textDropDogs}]`)}`);
      let gameCount = playPasses || 0;
      let errorCount = 0;
      while (gameCount > 0) {
        if (errorCount > 3) {
          gameCount = 0;
          continue;
        }
        // Bỏ qua kiểm tra API_KEY và REMAINING_QUOTA
        // if (!this.API_KEY) {
        //   user.log.log(colors.yellow(lang?.game?.no_api_key));
        //   gameCount = 0;
        //   continue;
        // }
        // if (this.REMAINING_QUOTA <= 0) {
        //   user.log.log(colors.yellow(lang?.game?.key_limit_used));
        //   gameCount = 0;
        //   continue;
        // }
        await delayHelper.delay(2);
        const delay = 30 + generatorHelper.randomInt(5, 10);
        const gameId = await this.playGame(user, lang, delay);
        if (gameId === 2) {
          gameCount = 0;
          continue;
        }
        if (gameId) {
          errorCount = 0;

          await delayHelper.delay(delay);
          const statusClaim = await this.claimGame(
            user,
            lang,
            gameId,
            eligibleDogs
          );
          if (!statusClaim) {
            errorCount++;
          }
          if (statusClaim) gameCount--;
        } else {
          errorCount++;
        }
      }
      if (playPasses > 0) user.log.log(colors.magenta(lang?.game?.used_turns));
      return -1;
    } else {
      const minutesUntilNextStart = this.getMinutesUntilNextStart(timePlayGame);
      user.log.log(
        colors.yellow(
          `${lang?.game?.skip_play_game_msg}: ${colors.blue(
            minutesUntilNextStart + ` ${lang?.game?.minute}`
          )}`
        )
      );
      return minutesUntilNextStart;
    }
  }
}

const gameService = new GameService();
export default gameService;
