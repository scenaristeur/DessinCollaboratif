# Package sketchpad pour le projet SmagYun http://smag0.blogspot.fr/2017/08/smagyun-une-arduino-yun-preparee-pour.html

Connectez la carte à internet

# install :

```
cd /root
git clone https://github.com/scenaristeur/sketchpad.git
cd sketchpad
npm install
node .

```

# Lancement du serveur sketchpad au démarrage de la carte SmagYun

créer un fichier de démarrage et rendez-le executable:
```

touch /etc/init.d/sketchpad
chmod +x /etc/init.d/sketchpad

```

voici le contenu du fichier /etc/init.d/sketchpad :

```

#!/bin/sh /etc/rc.common

START=99

boot() {
	node /root/sketchpad/ &
}
start() {
	node /root/sketchpad/ &
}
stop() {
	echo("sketchpad stop")
}

 ```


--> lancement possible par service :

```

/etc/init.d/sketchpad start

```
( si message "'bin/sh: can't open '/etc/rc.common " votre fichier est au format Windows, le changer en format Unix (en bas dans la barre d'état de Notepad++)
(vérifiez aussi l'encodage UTF-8)


ou lien de démarrage

```

ln -s /etc/init.d/sketchpad /etc/rc.d/S99sketchpad
```

L'application sketchpad sera accessible sur le port 3010, comme spécifié dans le fichier index.js
