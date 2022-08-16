import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'net';

interface Canvas {
  width: number;
  height: number;
}

interface Entity {
  x: number;
  y: number;
  size: number;
  speed: number;
}

function distance(a: Entity, b: Entity): number {
  const x = a.x - b.x;
  const y = a.y - b.y;
  return Math.sqrt(x * x + y * y);
}

@WebSocketGateway({ cors: true })
export class AppGateway {
  private herdSize = 50;
  private sheepInitialSize = 2;
  private sheepInitialSpeed = 20 / 1000;

  private wolfInitialSize = 5;
  private wolfMaxSize = 15;
  private wolfSizeGain =
    (this.wolfMaxSize - this.wolfInitialSize) / this.herdSize;

  private wolfInitialSpeed = 70 / 1000;
  private wolfMinSpeed = 25 / 1000;
  private woldSpeedDecay =
    (this.wolfInitialSpeed - this.wolfMinSpeed) / this.herdSize / 1000;

  private spawnWolf(canvas: Canvas): Entity {
    return {
      x: canvas.width / 2,
      y: canvas.height / 2,
      size: this.wolfInitialSize,
      speed: this.wolfInitialSpeed,
    };
  }

  private spawnHerd(canvas: Canvas): Entity[] {
    const herd: Entity[] = [];
    for (let i = 0; i < this.herdSize; i++) {
      herd.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: this.sheepInitialSize,
        speed: this.sheepInitialSpeed,
      });
    }

    return herd;
  }

  private moveSheep(
    sheep: Entity,
    wolf: Entity,
    canvas: Canvas,
    timeDelta: number,
  ) {
    const x = sheep.x - wolf.x;
    const y = sheep.y - wolf.y;

    const d = distance(sheep, wolf);

    if (d > 0) {
      sheep.x += (x / d) * sheep.speed * timeDelta;
      sheep.y += (y / d) * sheep.speed * timeDelta;
    }

    if (sheep.x < 0) sheep.x = 0;
    if (sheep.y < 0) sheep.y = 0;
    if (sheep.x > canvas.width) sheep.x = canvas.width;
    if (sheep.y > canvas.height) sheep.y = canvas.height;
  }

  private moveWolf(wolf: Entity, closestSheep: Entity, timeDelta: number) {
    const x = closestSheep.x - wolf.x;
    const y = closestSheep.y - wolf.y;

    const d = distance(closestSheep, wolf);

    if (d < wolf.speed * timeDelta) {
      wolf.x = closestSheep.x;
      wolf.y = closestSheep.y;
    } else {
      wolf.x += (x / d) * wolf.speed * timeDelta;
      wolf.y += (y / d) * wolf.speed * timeDelta;
    }
  }

  private eatSheep(wolf: Entity, sheep: Entity, herd: Entity[]) {
    const index = herd.indexOf(sheep);

    if (index > -1) {
      herd.splice(index, 1);

      wolf.size += this.wolfSizeGain;
      wolf.speed -= this.woldSpeedDecay;
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody() canvas: Canvas,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const wolf: Entity = this.spawnWolf(canvas);
    const herd: Entity[] = this.spawnHerd(canvas);

    let closestSheep: Entity | undefined = undefined;

    let start = new Date();

    while (herd.length > 0) {
      const now = new Date();
      const timeDelta = now.getTime() - start.getTime();

      herd.forEach((sheep) => {
        this.moveSheep(sheep, wolf, canvas, timeDelta);

        if (
          typeof closestSheep === 'undefined' ||
          distance(sheep, wolf) < distance(closestSheep, wolf)
        ) {
          closestSheep = sheep;
        }
      });

      this.moveWolf(wolf, closestSheep, timeDelta);

      if (distance(closestSheep, wolf) < wolf.size) {
        this.eatSheep(wolf, closestSheep, herd);
        closestSheep = undefined;
      }

      client.emit('message', {
        data: { wolf: wolf, herd: herd, closest: closestSheep },
      });

      start = now;

      // ~30 "FPS"
      await new Promise((resolve) => setTimeout(resolve, 1000 / 30));
    }
  }
}
